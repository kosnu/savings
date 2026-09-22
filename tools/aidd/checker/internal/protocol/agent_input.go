package protocol

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

// ResolveはTask IDから正本identityを解決する。更新の許可や検証成功は意味しない。
func Resolve(ctx context.Context, s *repository.Snapshot, id string, revision int) (*Loaded, string, error) {
	if err := pathcontract.ValidateWorkspaceName(id); err != nil {
		return nil, "", err
	}
	_, digest, err := read[Task](s, taskPath(id, "task.json"))
	if err != nil {
		return nil, "", err
	}
	l, err := loadTask(s, id, digest)
	if err != nil {
		return nil, "", err
	}
	if err = loadCheckpoints(s, l); err != nil {
		return nil, "", err
	}
	if revision >= 0 && revision != l.Checkpoint.Revision {
		return nil, "", fail("STALE_CHECKPOINT", id, "期待revisionが最新checkpointと一致しません")
	}
	if _, err = l.executionHead(ctx, s, false); err != nil {
		return nil, "", err
	}
	evidenceHash := ""
	if l.CheckpointHash != "" {
		exists, err := s.Exists(evidencePath(id, l.CheckpointHash))
		if err != nil {
			return nil, "", err
		}
		if exists {
			_, evidenceHash, err = read[Evidence](s, evidencePath(id, l.CheckpointHash))
			if err != nil {
				return nil, "", err
			}
		}
	}
	return l, evidenceHash, nil
}

type Changes[T any] struct {
	Upsert []T      `json:"upsert,omitempty"`
	Remove []string `json:"remove,omitempty"`
}
type DecisionUpdate struct {
	ChangeCoverage       Changes[ChangeCoverage]         `json:"change_coverage,omitzero"`
	Reason               string                          `json:"reason"`
	Requirements         Changes[Requirement]            `json:"requirements,omitzero"`
	Behaviors            Changes[model.ProductBehavior]  `json:"product_behaviors,omitzero"`
	Cases                Changes[model.VerificationCase] `json:"verification_cases,omitzero"`
	Scopes               Changes[model.OwnershipScope]   `json:"ownership_scopes,omitzero"`
	Representations      Changes[model.Representation]   `json:"representations,omitzero"`
	AdditionalRules      *[]string                       `json:"additional_rules,omitempty"`
	Integration          *Integration                    `json:"integration,omitempty"`
	CheckerMigration     *CheckerMigration               `json:"checker_migration,omitempty"`
	ScopeRevision        *ScopeRevision                  `json:"scope_revision,omitempty"`
	ProductAuthorization *ProductAuthorization           `json:"product_authorization,omitempty"`
}

// 意味判断を推測せず、ID/path単位の置換と明示削除だけを扱う。
func applyChanges[T any](old []T, change Changes[T], key func(T) string, less func(string, string) bool) ([]T, error) {
	values := map[string]T{}
	for _, v := range old {
		values[key(v)] = v
	}
	touched := map[string]bool{}
	for _, id := range change.Remove {
		if _, ok := values[id]; !ok || touched[id] {
			return nil, fail("UPDATE", id, "存在しない項目や重複した削除です")
		}
		touched[id] = true
		delete(values, id)
	}
	for _, v := range change.Upsert {
		id := key(v)
		if id == "" || touched[id] {
			return nil, fail("UPDATE", id, "空または重複する更新キーです")
		}
		touched[id] = true
		values[id] = v
	}
	ids := make([]string, 0, len(values))
	for id := range values {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return less(ids[i], ids[j]) })
	out := make([]T, 0, len(ids))
	for _, id := range ids {
		out = append(out, values[id])
	}
	return out, nil
}
func numberedLess(a, b string) bool {
	ap, an, _ := strings.Cut(a, "-")
	bp, bn, _ := strings.Cut(b, "-")
	if ap != bp {
		return ap < bp
	}
	if len(an) != len(bn) {
		return len(an) < len(bn)
	}
	return an < bn
}
func UpdateDecision(ctx context.Context, s *repository.Snapshot, id string, revision int, u DecisionUpdate) (string, error) {
	if revision < 1 {
		return "", fail("UPDATE", id, "既存checkpointの期待revisionが必要です")
	}
	l, _, err := Resolve(ctx, s, id, revision)
	if err != nil {
		return "", err
	}
	d := l.Checkpoint.Decision
	d.Reason = u.Reason
	d.ChangeCoverage, err = applyChanges(d.ChangeCoverage, u.ChangeCoverage, func(v ChangeCoverage) string { return v.ID }, func(a, b string) bool { return a < b })
	if err != nil {
		return "", err
	}
	d.Requirements, err = applyChanges(d.Requirements, u.Requirements, func(v Requirement) string { return v.ID }, semantic.RequirementIDLess)
	if err != nil {
		return "", err
	}
	d.Target.ProductBehaviors, err = applyChanges(d.Target.ProductBehaviors, u.Behaviors, func(v model.ProductBehavior) string { return v.ID }, numberedLess)
	if err != nil {
		return "", err
	}
	d.Target.VerificationCases, err = applyChanges(d.Target.VerificationCases, u.Cases, func(v model.VerificationCase) string { return v.ID }, numberedLess)
	if err != nil {
		return "", err
	}
	d.Target.OwnershipScopes, err = applyChanges(d.Target.OwnershipScopes, u.Scopes, func(v model.OwnershipScope) string { return v.Path }, func(a, b string) bool { return a < b })
	if err != nil {
		return "", err
	}
	d.Target.Representations, err = applyChanges(d.Target.Representations, u.Representations, func(v model.Representation) string { return v.ID }, numberedLess)
	if err != nil {
		return "", err
	}
	if u.AdditionalRules != nil {
		d.AdditionalRules = *u.AdditionalRules
	}
	if u.Integration != nil {
		d.Integration = u.Integration
	}
	if u.CheckerMigration != nil {
		d.CheckerMigration = u.CheckerMigration
	}
	// 範囲追加は一回限りのイベント。適用済みの権限・制限は履歴から復元する。
	d.ScopeRevision = u.ScopeRevision
	if u.ProductAuthorization != nil {
		d.ProductAuthorization = u.ProductAuthorization
	}
	return CheckpointDecision(ctx, s, id, l.TaskHash, l.CheckpointHash, d)
}

// Pageは詳細を明示取得するための表示。完全な契約や検証成功の代替ではない。
type Page struct {
	Task     string `json:"task"`
	Revision int    `json:"revision"`
	Field    string `json:"field"`
	Offset   int    `json:"offset"`
	Total    int    `json:"total_characters"`
	Next     *int   `json:"next_offset"`
	Content  string `json:"content"`
}

func Inspect(ctx context.Context, s *repository.Snapshot, id, field string, offset, limit int) (Page, error) {
	if offset < 0 || limit < 1 || limit > 4000 {
		return Page{}, fmt.Errorf("offset >= 0, 1 <= limit <= 4000 required")
	}
	l, eh, err := Resolve(ctx, s, id, -1)
	if err != nil {
		return Page{}, err
	}
	var value any
	switch field {
	case "summary":
		state := "checkpoint_required"
		detail := "判断をcheckpointへ固定してください"
		if l.CheckpointHash != "" {
			state = "verification_required"
			detail = "最新checkpointの検証証跡が必要です"
		}
		if eh != "" {
			checked, e := Load(ctx, s, id, l.TaskHash, l.CheckpointHash)
			if e == nil {
				_, e = ValidateEvidence(ctx, s, checked, eh)
			}
			if e == nil {
				state = "evidence_valid"
				detail = "証跡の整合確認済み。意味的review・配信完了は別途確認してください"
			} else {
				state = "verification_required"
				detail = e.Error()
			}
		}
		value = struct {
			Objective   string                   `json:"objective"`
			Constraints []string                 `json:"constraints"`
			Done        []string                 `json:"done"`
			State       string                   `json:"state"`
			Detail      string                   `json:"detail"`
			Cases       []model.VerificationCase `json:"verification_cases"`
		}{l.Task.Spec.Objective, l.Task.Spec.Constraints, l.Task.Spec.Done, state, detail, l.Checkpoint.Decision.Target.VerificationCases}
	case "task":
		value = l.Task.Spec
	case "change_coverage":
		value = l.Checkpoint.Decision.ChangeCoverage
	case "change_coverage_model":
		value = l.ChangeCoverageModel
	case "decision":
		value = l.Checkpoint.Decision
	case "requirements":
		value = l.Checkpoint.Decision.Requirements
	case "ownership_scopes":
		value = l.Checkpoint.Decision.Target.OwnershipScopes
	case "representations":
		value = l.Checkpoint.Decision.Target.Representations
	case "verification_cases":
		value = l.Checkpoint.Decision.Target.VerificationCases
	case "product_behaviors":
		value = l.Checkpoint.Decision.Target.ProductBehaviors
	default:
		return Page{}, fmt.Errorf("unknown field %q", field)
	}
	b, err := canonical.Pretty(value)
	if err != nil {
		return Page{}, err
	}
	chars := []rune(string(b))
	if offset > len(chars) {
		return Page{}, fmt.Errorf("offset exceeds total_characters")
	}
	end := min(offset+limit, len(chars))
	p := Page{Task: id, Revision: l.Checkpoint.Revision, Field: field, Offset: offset, Total: len(chars), Content: string(chars[offset:end])}
	if end < len(chars) {
		p.Next = &end
	}
	return p, nil
}

func (u *DecisionUpdate) UnmarshalJSON(b []byte) error {
	type updateWire DecisionUpdate
	var fields map[string]json.RawMessage
	if err := canonical.Decode(b, "decision_update", &fields); err != nil {
		return err
	}
	for key, value := range fields {
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fail("UPDATE", key, "nullでの暗黙削除はできません。collectionはremoveを指定してください")
		}
	}
	var wire updateWire
	if err := canonical.Decode(b, "decision_update", &wire); err != nil {
		return err
	}
	*u = DecisionUpdate(wire)
	return nil
}

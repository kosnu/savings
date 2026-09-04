package protocol

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

func (l *Loaded) validateDecision(d Decision) ([]string, error) {
	if d.SchemaVersion != Version || d.Kind != "decision" || d.TaskSHA256 != l.TaskHash || strings.TrimSpace(d.Reason) == "" {
		return nil, fail("DECISION", l.Task.Spec.ID, "decisionの版・task参照・判断理由が必要です")
	}
	ids := []string{}
	seen := map[string]bool{}
	for _, r := range d.Requirements {
		if r.ID == "" || seen[r.ID] || strings.TrimSpace(r.Text) == "" || strings.TrimSpace(r.Evidence) == "" {
			return nil, fail("REQUIREMENT", r.ID, "一意の要求ID・本文・根拠が必要です")
		}
		switch r.Origin {
		case "intent":
			if !strings.Contains(l.Task.Spec.Intent.Body, r.Evidence) {
				return nil, fail("PROVENANCE", r.ID, "intent根拠がsnapshot本文にありません")
			}
		case "guardrail":
			if _, ok := l.Rules.ByID[r.Evidence]; !ok {
				return nil, fail("PROVENANCE", r.ID, "guardrail根拠はrule IDで指定します")
			}
		case "derived":
		default:
			return nil, fail("PROVENANCE", r.ID, "originはintent/guardrail/derivedです")
		}
		ids = append(ids, r.ID)
		seen[r.ID] = true
	}
	if len(ids) == 0 {
		return nil, fail("REQUIREMENT", l.Task.Spec.ID, "要求は1件以上必要です")
	}
	if err := semantic.ValidateTargetState(&d.Target, ids, "decision"); err != nil {
		return nil, err
	}
	if _, err := semantic.ValidateProfiles(&d.Target, l.Catalog, "decision"); err != nil {
		return nil, err
	}
	for _, s := range d.Target.OwnershipScopes {
		if s.Path == ".aidd" || strings.HasPrefix(s.Path, ".aidd/") {
			return nil, fail("SCOPE", s.Path, "checker成果物を実装scopeにできません")
		}
		if l.Task.Spec.Kind == "learn" && !scopeCovered(s, l.Task.Spec.AuthorizedScopes) {
			return nil, fail("LEARN_SCOPE", s.Path, "明示許可を超えるownershipです")
		}
		for _, f := range l.Task.Baseline {
			if owned(f.Path, []model.OwnershipScope{s}) && l.guarded(f.Path) && l.mixed(f.Path) == nil && f.Path != lockPath && l.Task.Spec.Kind == "development" {
				return nil, fail("GUARDRAIL_SCOPE", f.Path, "guardrailをDevelopment scopeへ含められません")
			}
		}
	}
	paths := map[string]bool{}
	for _, f := range l.Task.Baseline {
		if owned(f.Path, d.Target.OwnershipScopes) {
			paths[f.Path] = true
		}
	}
	for _, r := range d.Target.Representations {
		if l.Task.Spec.Kind == "development" && l.guarded(r.Path) && l.mixed(r.Path) == nil && r.Path != lockPath {
			return nil, fail("GUARDRAIL_SCOPE", r.Path, "guardrailをDevelopment成果物にできません")
		}
		if l.Task.Spec.Kind == "learn" && (!l.guarded(r.Path) || rules.MatchesPath(l.Policy.ProductPaths, r.Path)) {
			return nil, fail("LEARN_SCOPE", r.Path, "Learnにproduct成果物を含められません")
		}
		paths[r.Path] = true
	}
	direct := map[string]struct{}{}
	for p := range paths {
		_, required, err := rules.ResolvePath(l.Rules, p)
		if err != nil {
			return nil, err
		}
		for _, id := range required {
			direct[id] = struct{}{}
		}
	}
	for _, id := range d.AdditionalRules {
		direct[id] = struct{}{}
	}
	for _, r := range d.Requirements {
		if r.Origin == "guardrail" {
			direct[r.Evidence] = struct{}{}
		}
	}
	closure, err := rules.ExpandClosure(l.Rules, direct)
	if err != nil {
		return nil, err
	}
	selected := rules.Sorted(closure)
	for _, id := range selected {
		if _, ok := fileMap(l.Task.Baseline)[l.Rules.ByID[id].File]; !ok {
			return nil, fail("RULE_SOURCE", id, "rule文書がtask baselineにありません")
		}
	}
	if err = l.requireProfiles(d.Target, paths); err != nil {
		return nil, err
	}
	return selected, nil
}

func scopeCovered(scope model.OwnershipScope, allowed []model.OwnershipScope) bool {
	for _, a := range allowed {
		if a.Kind == "tree" && owned(scope.Path, []model.OwnershipScope{a}) || a.Kind == "file" && scope.Kind == "file" && a.Path == scope.Path {
			return true
		}
	}
	return false
}

func (l *Loaded) requireProfiles(target model.TargetState, paths map[string]bool) error {
	have := map[string]bool{}
	for _, c := range target.VerificationCases {
		if c.Type == "automated" && c.Selector != nil && c.Selector.Kind == "suite" {
			have[c.VerificationProfileID] = true
		}
	}
	for _, route := range l.Policy.RequiredVerification {
		for p := range paths {
			if rules.MatchesPath(route.Paths, p) {
				for _, id := range route.Profiles {
					if !have[id] {
						return fail("VERIFICATION_COVERAGE", p, "必須suite profileがありません: "+id)
					}
				}
			}
		}
	}
	return nil
}

func loadCheckpoints(snapshot *repository.Snapshot, l *Loaded) error {
	directory := taskPath(l.Task.Spec.ID, "checkpoints")
	exists, err := snapshot.Exists(directory)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	entries, err := snapshot.ReadDir(directory)
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	parent := ""
	for i, entry := range entries {
		path := checkpointPath(l.Task.Spec.ID, i+1)
		if entry.Name() != fmt.Sprintf("%06d.json", i+1) {
			return fail("REVISION", path, "checkpoint履歴に欠落または未定義ファイルがあります")
		}
		cp, h, err := readMode[Checkpoint](snapshot, path, l.Delivered)
		if err != nil {
			return err
		}
		if cp.SchemaVersion != Version || cp.Kind != "checkpoint" || cp.TaskSHA256 != l.TaskHash || cp.Revision != i+1 || cp.ParentSHA256 != parent {
			return fail("REVISION", path, "checkpoint chainが一致しません")
		}
		required, err := l.validateDecision(cp.Decision)
		if err != nil {
			return err
		}
		if !sameStrings(required, cp.Rules) {
			return fail("RULE_COVERAGE", path, "必要なrule closureが一致しません")
		}
		l.Checkpoint = cp
		l.CheckpointHash = h
		parent = h
	}
	return nil
}

func CheckpointDecision(ctx context.Context, snapshot *repository.Snapshot, id, taskHash, parentHash string, d Decision) (string, error) {
	l, err := loadTask(snapshot, id, taskHash)
	if err != nil {
		return "", err
	}
	if err = l.checkAuthority(); err != nil {
		return "", err
	}
	if _, err = l.executionHead(ctx, snapshot, true); err != nil {
		return "", err
	}
	if err = loadCheckpoints(snapshot, l); err != nil {
		return "", err
	}
	if parentHash != l.CheckpointHash {
		return "", fail("REVISION", id, "最新checkpointを親として指定してください")
	}
	files, err := inventory(ctx, snapshot)
	if err != nil {
		return "", err
	}
	if err = l.checkGuards(ctx, snapshot, files); err != nil {
		return "", err
	}
	required, err := l.validateDecision(d)
	if err != nil {
		return "", err
	}
	cp := Checkpoint{Version, "checkpoint", taskHash, l.Checkpoint.Revision + 1, parentHash, d, required}
	// baselineはTaskからのみ引き継ぎ、改訂時のworktreeで再構成しない。
	return write(snapshot, checkpointPath(id, cp.Revision), cp, true)
}

func Load(ctx context.Context, snapshot *repository.Snapshot, id, taskHash, checkpointHash string) (*Loaded, error) {
	l, err := loadTask(snapshot, id, taskHash)
	if err != nil {
		return nil, err
	}
	if err = loadCheckpoints(snapshot, l); err != nil {
		return nil, err
	}
	if !digestPattern.MatchString(checkpointHash) || l.CheckpointHash != checkpointHash {
		return nil, fail("STALE_CHECKPOINT", id, "最新checkpointと一致しません")
	}
	if err = l.checkAuthority(); err != nil {
		return nil, err
	}
	if _, err = l.executionHead(ctx, snapshot, false); err != nil {
		return nil, err
	}
	files, err := inventory(ctx, snapshot)
	if err != nil {
		return nil, err
	}
	if err = l.checkGuards(ctx, snapshot, files); err != nil {
		return nil, err
	}
	return l, nil
}

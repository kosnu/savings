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
	if d.SchemaVersion != l.Task.SchemaVersion || d.Kind != "decision" || d.TaskSHA256 != l.TaskHash || strings.TrimSpace(d.Reason) == "" {
		return nil, fail("DECISION", l.Task.Spec.ID, "decisionの版・task参照・判断理由が必要です")
	}
	if err := l.validateProductAuthorization(d); err != nil {
		return nil, err
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
	if err := semantic.ValidateTargetState(&d.Target, ids, "decision", l.RepositoryPolicy.ForbiddenTreeScopes); err != nil {
		return nil, err
	}
	if _, err := semantic.ValidateProfiles(&d.Target, l.Catalog, "decision"); err != nil {
		return nil, err
	}
	for _, s := range d.Target.OwnershipScopes {
		if !l.withinUserLimits(s) {
			return nil, fail("USER_SCOPE_LIMIT", s.Path, "ユーザーの明示制限を超えるownershipです")
		}
		if s.Path == ".aidd" || strings.HasPrefix(s.Path, ".aidd/") {
			return nil, fail("SCOPE", s.Path, "checker成果物を実装scopeにできません")
		}
		if l.Task.Spec.Kind == "learn" && !scopeCovered(s, l.authorizedScopes()) {
			return nil, fail("LEARN_SCOPE", s.Path, "明示許可を超えるownershipです")
		}
	}
	paths := map[string]bool{}
	for _, f := range l.changeBaseline() {
		if owned(f.Path, d.Target.OwnershipScopes) {
			paths[f.Path] = true
		}
	}
	for _, r := range d.Target.Representations {
		paths[r.Path] = true
	}
	if err := l.validateChangeCoverage(d, paths, false); err != nil {
		return nil, err
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
		if cp.SchemaVersion != l.Task.SchemaVersion || cp.Kind != "checkpoint" || cp.TaskSHA256 != l.TaskHash || cp.Revision != i+1 || cp.ParentSHA256 != parent {
			return fail("REVISION", path, "checkpoint chainが一致しません")
		}
		if err := l.selectCheckerMigration(snapshot, cp.Decision.CheckerMigration, parent); err != nil {
			return err
		}
		if err := l.selectIntegration(context.Background(), snapshot, cp.Decision.Integration); err != nil {
			return err
		}
		if cp.SchemaVersion == CompactVersion {
			if len(cp.RuleMap) != 0 {
				return fail("RULE_COVERAGE", path, "v6はrule-map参照だけを保持します")
			}
			cp.RuleMap, err = readRuleMap(snapshot, l, cp.RuleMapReference)
			if err != nil {
				return err
			}
		} else if cp.RuleMapReference != nil {
			return fail("RULE_COVERAGE", path, "v5にはv6参照を使えません")
		}
		if len(cp.RuleMap) > 0 {
			active, err := rules.Parse(cp.RuleMap, rules.DefaultPath)
			if err != nil {
				return err
			}
			l.Rules = active
		}
		if err := l.selectScopeRevision(cp.Decision.ScopeRevision, parent); err != nil {
			return err
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
	if _, err = l.executionHead(ctx, snapshot, true); err != nil {
		return "", err
	}
	if err = loadCheckpoints(snapshot, l); err != nil {
		return "", err
	}
	if parentHash != l.CheckpointHash {
		return "", fail("REVISION", id, "最新checkpointを親として指定してください")
	}
	if err = l.selectCheckerMigration(snapshot, d.CheckerMigration, parentHash); err != nil {
		return "", err
	}
	if err = l.checkAuthority(); err != nil {
		return "", err
	}
	if err = l.selectIntegration(ctx, snapshot, d.Integration); err != nil {
		return "", err
	}
	// 更新後の索引をcheckpointへ保存し、履歴のrule closureは各時点の索引で読む。
	ruleMap, err := snapshot.Read(rules.DefaultPath)
	if err != nil {
		return "", err
	}
	l.Rules, err = rules.Load(snapshot, rules.DefaultPath)
	if err != nil {
		return "", err
	}
	for _, rule := range l.Rules.Map.Rules {
		if _, err := snapshot.Read(rule.File); err != nil {
			return "", err
		}
	}
	l.Checkpoint.Decision = d
	if err = l.loadPeerScopes(ctx, snapshot); err != nil {
		return "", err
	}
	files, err := inventory(ctx, snapshot)
	if err != nil {
		return "", err
	}
	if d.ScopeRevision != nil {
		// 追加許可を適用する前に既存範囲で検査し、編集後の事後承認を防ぐ。
		if err = l.checkGuards(ctx, snapshot, files); err != nil {
			return "", err
		}
	}
	if err = l.selectScopeRevision(d.ScopeRevision, parentHash); err != nil {
		return "", err
	}
	if err = l.checkGuards(ctx, snapshot, files); err != nil {
		return "", err
	}
	required, err := l.validateDecision(d)
	if err != nil {
		return "", err
	}
	cp := Checkpoint{SchemaVersion: l.Task.SchemaVersion, Kind: "checkpoint", TaskSHA256: taskHash, Revision: l.Checkpoint.Revision + 1, ParentSHA256: parentHash, Decision: d, Rules: required, RuleMap: ruleMap}
	if cp.SchemaVersion == CompactVersion {
		cp.RuleMapReference, err = saveRuleMap(snapshot, l, ruleMap)
		if err != nil {
			return "", err
		}
		cp.RuleMap = nil
	}
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
	if err = l.loadPeerScopes(ctx, snapshot); err != nil {
		return nil, err
	}
	if len(l.Checkpoint.RuleMap) > 0 {
		current, err := snapshot.Read(rules.DefaultPath)
		if err != nil {
			return nil, err
		}
		if hash(current) != hash(l.Checkpoint.RuleMap) {
			return nil, fail("RULE_COVERAGE", rules.DefaultPath, "変更後の索引でcheckpointを更新してください")
		}
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

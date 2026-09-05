package protocol

import (
	"context"
	"regexp"
	"slices"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
var issuePattern = regexp.MustCompile(`^https://github\.com/[^/]+/[^/]+/issues/[1-9][0-9]*$`)

func validateSpec(spec Spec) error {
	if spec.Action != "execute" {
		return fail("ENTRYPOINT", spec.ID, "質問・説明・調査ではtaskを開始しません。実行依頼が必要です")
	}
	if spec.SchemaVersion != Version || (spec.Kind != "development" && spec.Kind != "learn") {
		return fail("PROTOCOL", "schema_version", "新規実行はv5 development/learnだけを受け付けます")
	}
	if err := pathcontract.ValidateWorkspaceName(spec.ID); err != nil {
		return err
	}
	if strings.TrimSpace(spec.Objective) == "" || len(spec.Constraints) == 0 || len(spec.Done) == 0 || len(spec.Verification) == 0 {
		return fail("TASK", spec.ID, "objective/constraints/done/verificationが必要です")
	}
	for _, items := range [][]string{spec.Constraints, spec.Done, spec.Verification} {
		for _, s := range items {
			if strings.TrimSpace(s) == "" {
				return fail("TASK", spec.ID, "空の契約項目は使えません")
			}
		}
	}
	if spec.Intent.Body == "" || canonical.HashBytes([]byte(spec.Intent.Body)) != spec.Intent.BodySHA256 || spec.Intent.Reference == "" {
		return fail("INTENT", spec.ID, "intent本文と出典・hashが必要です")
	}
	if spec.Delivery != "local" && spec.Delivery != "pr" {
		return fail("DELIVERY", spec.ID, "deliveryはlocalまたはprを指定します")
	}
	if spec.Kind == "development" {
		if spec.Intent.Kind != "issue" || !issuePattern.MatchString(spec.Intent.Reference) || spec.Authorization != "" || len(spec.AuthorizedScopes) > 0 {
			return fail("INTENT", spec.ID, "DevelopmentはGitHub Issueを入口としLearn許可を持ちません")
		}
	} else if spec.Intent.Kind != "feedback" || strings.TrimSpace(spec.Authorization) == "" || len(spec.AuthorizedScopes) == 0 {
		return fail("LEARN_AUTHORITY", spec.ID, "Learnにはfeedbackと明示的な変更許可・有限scopeが必要です")
	}
	for _, scope := range spec.AuthorizedScopes {
		if _, err := pathcontract.ValidateRelativePath(scope.Path); err != nil {
			return err
		}
		if scope.Kind != "file" && scope.Kind != "tree" {
			return fail("SCOPE", scope.Path, "file/tree scopeが必要です")
		}
	}
	return nil
}

func parsePolicy(content []byte) (Policy, error) {
	var p Policy
	if err := canonical.Decode(content, "protocol_policy", &p); err != nil {
		return p, err
	}
	if p.SchemaVersion != 1 || p.Kind != "aidd_protocol" || len(p.GuardrailPaths) == 0 || len(p.ProductPaths) == 0 {
		return p, fail("POLICY", PolicyPath, "protocol policyが不完全です")
	}
	for _, route := range p.RequiredVerification {
		if len(route.Paths) == 0 || len(route.Profiles) == 0 {
			return p, fail("POLICY", PolicyPath, "必須検証routingが不完全です")
		}
	}
	return p, nil
}

func Start(ctx context.Context, snapshot *repository.Snapshot, spec Spec) (string, error) {
	if err := validateSpec(spec); err != nil {
		return "", err
	}
	if err := CheckConfiguration(ctx, snapshot); err != nil {
		return "", err
	}
	if exists, err := snapshot.Exists(taskPath(spec.ID, "task.json")); err != nil {
		return "", err
	} else if exists {
		return "", fail("BASELINE", spec.ID, "既存taskのbaselineは取り直せません")
	}
	dirty, err := snapshot.Git(ctx, "status", "--porcelain=v1", "--untracked-files=all")
	if err != nil {
		return "", err
	}
	if len(dirty) != 0 {
		return "", fail("BASELINE", spec.ID, "task開始にはcleanな専用worktreeが必要です")
	}
	head, err := snapshot.Head(ctx)
	if err != nil {
		return "", err
	}
	policy, err := snapshot.Read(PolicyPath)
	if err != nil {
		return "", err
	}
	if _, err = parsePolicy(policy); err != nil {
		return "", err
	}
	ruleMap, err := snapshot.Read(rules.DefaultPath)
	if err != nil {
		return "", err
	}
	if _, err = rules.Parse(ruleMap, rules.DefaultPath); err != nil {
		return "", err
	}
	profiles, err := snapshot.Read(catalog.DefaultPath)
	if err != nil {
		return "", err
	}
	if _, err = catalog.Parse(profiles, catalog.DefaultPath); err != nil {
		return "", err
	}
	files, err := inventory(ctx, snapshot)
	if err != nil {
		return "", err
	}
	gate, err := checkerIdentity()
	if err != nil {
		return "", err
	}
	task := Task{Version, "task", spec, head, files, policy, ruleMap, profiles, gate}
	if err = snapshot.AssertGitHeadUnchanged(ctx); err != nil {
		return "", err
	}
	return write(snapshot, taskPath(spec.ID, "task.json"), task, true)
}

type Loaded struct {
	Delivered      bool
	Task           Task
	TaskHash       string
	Checkpoint     Checkpoint
	CheckpointHash string
	Policy         Policy
	Rules          *rules.Loaded
	Catalog        *catalog.Resolved
}

func loadTask(snapshot *repository.Snapshot, id, expected string) (*Loaded, error) {
	return loadTaskMode(snapshot, id, expected, false)
}

func loadTaskMode(snapshot *repository.Snapshot, id, expected string, delivered bool) (*Loaded, error) {
	if err := pathcontract.ValidateWorkspaceName(id); err != nil {
		return nil, err
	}
	if !digestPattern.MatchString(expected) {
		return nil, fail("IDENTITY", id, "task SHA-256を指定してください")
	}
	task, h, err := readMode[Task](snapshot, taskPath(id, "task.json"), delivered)
	if err != nil {
		return nil, err
	}
	if h != expected || task.SchemaVersion != Version || task.Kind != "task" || task.Spec.ID != id {
		return nil, fail("IDENTITY", id, "task identityが一致しません")
	}
	if err = validateSpec(task.Spec); err != nil {
		return nil, err
	}
	p, err := parsePolicy(task.Policy)
	if err != nil {
		return nil, err
	}
	r, err := rules.Parse(task.RuleMap, rules.DefaultPath)
	if err != nil {
		return nil, err
	}
	c, err := catalog.Parse(task.Catalog, catalog.DefaultPath)
	if err != nil {
		return nil, err
	}
	return &Loaded{Delivered: delivered, Task: task, TaskHash: h, Policy: p, Rules: r, Catalog: c}, nil
}

func owned(path string, scopes []model.OwnershipScope) bool {
	for _, s := range scopes {
		if path == s.Path || s.Kind == "tree" && strings.HasPrefix(path, s.Path+"/") {
			return true
		}
	}
	return false
}

func (l *Loaded) mixed(path string) *MixedJSONRule {
	for i := range l.Policy.MixedJSON {
		if l.Policy.MixedJSON[i].Path == path {
			return &l.Policy.MixedJSON[i]
		}
	}
	return nil
}

func (l *Loaded) guarded(path string) bool {
	if path == lockPath && len(l.Policy.MixedJSON) > 0 {
		return true
	}
	if path == PolicyPath || path == rules.DefaultPath || path == catalog.DefaultPath || path == "AGENTS.md" || rules.MatchesPath(l.Policy.GuardrailPaths, path) {
		return true
	}
	for _, r := range l.Rules.Map.Rules {
		if path == r.File {
			return true
		}
	}
	return false
}

func (l *Loaded) checkGuards(ctx context.Context, snapshot *repository.Snapshot, files []File) error {
	for _, path := range changed(transportFiles(l.Task.Baseline, l.Delivered), transportFiles(withoutGenerated(files, l.Task.Spec.ID), l.Delivered)) {
		if path == lockPath && len(l.Policy.MixedJSON) > 0 {
			if err := l.checkLock(ctx, snapshot, files); err != nil {
				return err
			}
			continue
		}
		if mixed := l.mixed(path); mixed != nil {
			if err := l.checkMixed(ctx, snapshot, *mixed, files); err != nil {
				return err
			}
			continue
		}
		if l.Task.Spec.Kind == "development" {
			if l.guarded(path) {
				return fail("GUARDRAIL_DRIFT", path, "Developmentはguardrailを変更できません")
			}
		} else if !l.guarded(path) || rules.MatchesPath(l.Policy.ProductPaths, path) || !owned(path, l.Task.Spec.AuthorizedScopes) {
			return fail("LEARN_SCOPE", path, "Learnは明示的に許可されたguardrailだけを変更できます")
		}
	}
	return nil
}

func (l *Loaded) checkAuthority() error {
	actual, err := checkerIdentity()
	if err != nil {
		return err
	}
	if actual != l.Task.CheckerSHA256 {
		return fail("CHECKER_IDENTITY", l.Task.Spec.ID, "task開始時のchecker binaryを使ってください。新checkerだけの成功は証拠になりません")
	}
	return nil
}

func sameStrings(a, b []string) bool { return slices.Equal(a, b) }

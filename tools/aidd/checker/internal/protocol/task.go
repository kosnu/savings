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
	"github.com/kosnu/savings/tools/aidd/checker/internal/repositorypolicy"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
var issuePattern = regexp.MustCompile(`^https://github\.com/[^/]+/[^/]+/issues/[1-9][0-9]*$`)

func validateSpec(spec Spec) error {
	if spec.Action != "execute" {
		return fail("ENTRYPOINT", spec.ID, "質問・説明・調査ではtaskを開始しません。実行依頼が必要です")
	}
	if !supportedVersion(spec.SchemaVersion) || (spec.Kind != "development" && spec.Kind != "learn") {
		return fail("PROTOCOL", "schema_version", "schema v5/v6 development/learnが必要です")
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
	if spec.LegacyDelivery != "" && spec.LegacyDelivery != "local" && spec.LegacyDelivery != "pr" {
		return fail("DELIVERY", spec.ID, "旧delivery記録はlocalまたはprだけを読み取れます")
	}
	if spec.Kind == "development" {
		if spec.Intent.Kind != "issue" || !issuePattern.MatchString(spec.Intent.Reference) || spec.Authorization != "" || len(spec.AuthorizedScopes) > 0 {
			return fail("INTENT", spec.ID, "DevelopmentはGitHub Issueを入口としLearn許可を持ちません")
		}
	} else if spec.Intent.Kind != "feedback" || strings.TrimSpace(spec.Authorization) == "" || len(spec.AuthorizedScopes) == 0 {
		return fail("LEARN_AUTHORITY", spec.ID, "Learnにはfeedbackと明示的な変更許可・有限scopeが必要です")
	}
	for _, scope := range append(append([]model.OwnershipScope{}, spec.AuthorizedScopes...), spec.UserScopeLimits...) {
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
	// 新規Taskでは廃止fieldを保存しない。既存Taskの読取時はそのまま保持する。
	spec.LegacyDelivery = ""
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
	task := Task{SchemaVersion: spec.SchemaVersion, Kind: "task", Spec: spec, BaselineHead: head, Baseline: files, Policy: policy, RuleMap: ruleMap, Catalog: profiles, CheckerSHA256: gate}
	if spec.SchemaVersion == CompactVersion {
		task.BaselineModes = baselineModes(files)
		baseline, err := gitInventory(ctx, snapshot, head)
		if err != nil {
			return "", err
		}
		if hash(transportFiles(files, true)) != hash(baseline) {
			return "", fail("BASELINE", spec.ID, "開始状態とGit treeが一致しません")
		}
	}
	if err = snapshot.AssertGitHeadUnchanged(ctx); err != nil {
		return "", err
	}
	return write(snapshot, taskPath(spec.ID, "task.json"), task, true)
}

type Loaded struct {
	ChangeCoverageModel *ChangeCoverageModel
	RepositoryPolicy    repositorypolicy.Policy
	CheckerMigration    *CheckerMigration
	MigrationScopes     []model.OwnershipScope
	RevisionScopes      []model.OwnershipScope
	RevisionLimits      [][]model.OwnershipScope
	Integration         *Integration
	IntegrationBaseline []File
	Delivered           bool
	Task                Task
	TaskHash            string
	Checkpoint          Checkpoint
	CheckpointHash      string
	Policy              Policy
	Rules               *rules.Loaded
	PeerScopes          []model.OwnershipScope
	Catalog             *catalog.Resolved
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
	if h != expected || !supportedVersion(task.SchemaVersion) || task.Spec.SchemaVersion != task.SchemaVersion || task.Kind != "task" || task.Spec.ID != id {
		return nil, fail("IDENTITY", id, "task identityが一致しません")
	}
	if task.SchemaVersion == Version && len(task.BaselineModes) != 0 {
		return nil, fail("BASELINE", id, "v5にはv6権限例外を指定できません")
	}
	if err = validateSpec(task.Spec); err != nil {
		return nil, err
	}
	if err := hydrateTask(context.Background(), snapshot, &task); err != nil {
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
	rp, err := taskRepositoryPolicy(snapshot, task)
	if err != nil {
		return nil, err
	}
	if _, exists := fileMap(task.Baseline)[repositorypolicy.Path]; exists {
		if err := rp.ValidateProfiles(c.Profiles); err != nil {
			return nil, err
		}
	}
	cm, err := taskChangeCoverage(snapshot, task)
	if err != nil {
		return nil, err
	}
	return &Loaded{ChangeCoverageModel: cm, RepositoryPolicy: rp, Delivered: delivered, Task: task, TaskHash: h, Policy: p, Rules: r, Catalog: c}, nil
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

// Task種別で変更面を隔離せず、実際の許可範囲を検査する。
func (l *Loaded) checkGuards(ctx context.Context, snapshot *repository.Snapshot, files []File) error {
	if err := l.validateProductAuthorization(l.Checkpoint.Decision); err != nil {
		return err
	}
	for _, path := range l.changedPaths(files) {
		if !l.withinUserLimits(model.OwnershipScope{Path: path, Kind: "file"}) {
			return fail("USER_SCOPE_LIMIT", path, "ユーザーの明示制限を超える変更です")
		}
		if l.Task.Spec.Kind == "learn" && !owned(path, l.authorizedScopes()) {
			return fail("LEARN_SCOPE", path, "記録された変更許可の範囲外です")
		}
		if rules.MatchesPath(l.Policy.ProductPaths, path) {
			if err := l.checkProductAuthorization(path); err != nil {
				return err
			}
		}
		if path == lockPath && len(l.Policy.MixedJSON) > 0 {
			if err := l.checkLock(ctx, snapshot, files); err != nil {
				return err
			}
		} else if mixed := l.mixed(path); mixed != nil {
			if err := l.checkMixed(ctx, snapshot, *mixed, files); err != nil {
				return err
			}
		}
	}
	return nil
}

func (l *Loaded) checkAuthority() error {
	actual, err := checkerIdentity()
	if err != nil {
		return err
	}
	if actual != l.executionChecker() {
		return fail("CHECKER_IDENTITY", l.Task.Spec.ID, "task開始時のchecker binaryを使ってください。新checkerだけの成功は証拠になりません")
	}
	return nil
}

func sameStrings(a, b []string) bool { return slices.Equal(a, b) }

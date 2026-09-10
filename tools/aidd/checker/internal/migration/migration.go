// Package migrationは非互換なAIDD契約を移行するbase側の検査を担う。
package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
)

const RequestFence = "```aidd-contract-migration\n"
const Environment = "aidd-contract-migration"

var shaPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

type Request struct {
	SchemaVersion int    `json:"schema_version"`
	Kind          string `json:"kind"`
	TargetBase    string `json:"target_base_sha"`
	HeadSHA       string `json:"head_sha"`
	TaskID        string `json:"task_id"`
	Reason        string `json:"reason"`
}

// ParseRequestはPR本文の専用blockを1件だけ受け入れる。承認は別途GitHubで検証する。
func ParseRequest(body string) (Request, error) {
	var request Request
	normalized := strings.ReplaceAll(body, "\r\n", "\n")
	if strings.Count(normalized, RequestFence) != 1 {
		return request, fmt.Errorf("exactly one aidd-contract-migration block required in PR body")
	}
	_, rest, _ := strings.Cut(normalized, RequestFence)
	raw, _, closed := strings.Cut(rest, "\n```")
	if !closed {
		return request, fmt.Errorf("unclosed migration request")
	}
	if err := canonical.Decode([]byte(raw), "PR migration request", &request); err != nil {
		return request, err
	}
	return request, nil
}

// CheckScopeはcandidateを実行せずGitのblobとmodeだけを検査する。
// Task形式の意味検査はcandidate CI、移行の採否は保護されたEnvironmentが担う。
func CheckScope(ctx context.Context, root, base, head string, m Request) error {
	if !shaPattern.MatchString(base) || !shaPattern.MatchString(head) {
		return fmt.Errorf("full base/head SHA required")
	}
	git := func(args ...string) ([]byte, error) {
		cmd := exec.CommandContext(ctx, "git", append([]string{"-C", root}, args...)...)
		for _, e := range os.Environ() {
			if !strings.HasPrefix(e, "GIT_") {
				cmd.Env = append(cmd.Env, e)
			}
		}
		cmd.Env = append(cmd.Env, "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null")
		b, err := cmd.Output()
		if err != nil {
			return nil, fmt.Errorf("git %s: %w", args[0], err)
		}
		return b, nil
	}
	if m.SchemaVersion != 1 || m.Kind != "aidd_contract_migration" || m.TargetBase != base || m.HeadSHA != head || pathcontract.ValidateWorkspaceName(m.TaskID) != nil || strings.TrimSpace(m.Reason) == "" {
		return fmt.Errorf("invalid or stale migration request")
	}
	baseline, err := git("merge-base", base, head)
	if err != nil {
		return err
	}
	paths, err := git("diff", "--no-renames", "--name-only", "-z", strings.TrimSpace(string(baseline)), head, "--")
	if err != nil {
		return err
	}
	implementation, task := false, false
	for _, p := range strings.Split(strings.TrimSuffix(string(paths), "\x00"), "\x00") {
		isTask := strings.HasPrefix(p, ".aidd/tasks/"+m.TaskID+"/")
		allowed := isTask || allowedPath(p)
		if !allowed {
			return fmt.Errorf("migration cannot change %s", p)
		}
		// 削除と実行modeは許可するがsymlink・submoduleへの型変更は拒否する。
		for _, ref := range []string{strings.TrimSpace(string(baseline)), head} {
			entry, e := git("ls-tree", ref, "--", p)
			if e != nil {
				return e
			}
			if len(entry) > 0 && !strings.HasPrefix(string(entry), "100644 blob ") && !strings.HasPrefix(string(entry), "100755 blob ") {
				return fmt.Errorf("migration requires regular blobs: %s", p)
			}
		}
		implementation = implementation || strings.HasPrefix(p, "tools/aidd/checker/") || strings.HasPrefix(p, "docs/ai-driven-development/contracts/")
		task = task || isTask
	}
	if !implementation || !task {
		return fmt.Errorf("migration requires a changed checker/contract and exactly one task")
	}
	// mainに保存済みのTask開始記録を移行で置き換えない。
	taskPath := ".aidd/tasks/" + m.TaskID + "/task.json"
	old, e := git("ls-tree", strings.TrimSpace(string(baseline)), "--", taskPath)
	if e != nil {
		return e
	}
	current, e := git("ls-tree", head, "--", taskPath)
	if e != nil {
		return e
	}
	if len(current) == 0 || (len(old) > 0 && string(old) != string(current)) {
		return fmt.Errorf("task identity must be present and preserved")
	}
	return nil
}

func allowedPath(p string) bool {
	for _, prefix := range []string{"tools/aidd/", "docs/ai-driven-development/", "docs/harness/", "docs/adr/", ".agents/skills/aidd-cycle/", ".agents/skills/learn/", ".agents/skills/harness-task/", ".agents/skills/goal-setting/"} {
		if strings.HasPrefix(p, prefix) {
			return true
		}
	}
	return p == ".github/workflows/aidd_checker_ci.yaml"
}

// APIはGitHubから取得したJSONだけを入力とする。candidate成果物を承認情報に使わない。
type API func(string, any) error

func GitHubAPI(ctx context.Context) API {
	return func(path string, dst any) error {
		c := exec.CommandContext(ctx, "gh", "api", path)
		b, err := c.Output()
		if err != nil {
			return fmt.Errorf("GitHub API %s: %w", path, err)
		}
		return json.Unmarshal(b, dst)
	}
}

// CheckApprovalは現在のPR identityと実runに残った人による承認を照合する。
func CheckApproval(api API, repo, pr, run, base, head, body string, approved bool) error {
	if !regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`).MatchString(repo) || !regexp.MustCompile(`^[1-9][0-9]*$`).MatchString(pr) || !regexp.MustCompile(`^[1-9][0-9]*$`).MatchString(run) || !shaPattern.MatchString(base) || !shaPattern.MatchString(head) {
		return fmt.Errorf("invalid CI identity")
	}
	prefix := "repos/" + repo
	var pull struct {
		State      string
		Body       string
		Head, Base struct{ SHA string }
	}
	if err := api(prefix+"/pulls/"+pr, &pull); err != nil {
		return err
	}
	if pull.State != "open" || pull.Head.SHA != head || pull.Base.SHA != base || pull.Body != body {
		return fmt.Errorf("PR base/head/body changed; new validation and approval required")
	}
	var env struct {
		ID              int64
		Name            string
		CanAdminsBypass *bool `json:"can_admins_bypass"`
		ProtectionRules []struct {
			Type      string
			Reviewers []struct {
				Type     string
				Reviewer struct {
					ID   int64
					Type string
				}
			}
		} `json:"protection_rules"`
	}
	if err := api(prefix+"/environments/"+Environment, &env); err != nil {
		return err
	}
	users := map[int64]bool{}
	for _, rule := range env.ProtectionRules {
		if rule.Type == "required_reviewers" {
			for _, r := range rule.Reviewers {
				if r.Type == "User" && r.Reviewer.Type == "User" && r.Reviewer.ID > 0 {
					users[r.Reviewer.ID] = true
				}
			}
		}
	}
	if env.ID <= 0 || env.Name != Environment || len(users) == 0 || env.CanAdminsBypass == nil || *env.CanAdminsBypass {
		return fmt.Errorf("migration environment must require named human reviewers and disable admin bypass")
	}
	if !approved {
		return nil
	}
	var execution struct {
		Event   string
		HeadSHA string `json:"head_sha"`
	}
	if err := api(prefix+"/actions/runs/"+run, &execution); err != nil {
		return err
	}
	if execution.Event != "pull_request" || execution.HeadSHA != head {
		return fmt.Errorf("approval run does not match candidate")
	}
	var reviews []struct {
		State string
		User  struct {
			ID   int64
			Type string
		}
		Environments []struct {
			ID   int64
			Name string
		}
	}
	if err := api(prefix+"/actions/runs/"+run+"/approvals", &reviews); err != nil {
		return err
	}
	found := false
	for _, r := range reviews {
		for _, e := range r.Environments {
			if e.ID == env.ID && e.Name == Environment {
				if r.State != "approved" {
					return fmt.Errorf("migration approval rejected")
				}
				if r.User.Type == "User" && users[r.User.ID] {
					found = true
				}
			}
		}
	}
	if !found {
		return fmt.Errorf("no human approval for this run and environment")
	}
	return nil
}

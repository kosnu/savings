package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"go.yaml.in/yaml/v3"
)

func TestScopeUsesGitAndRejectsUnrelatedChanges(t *testing.T) {
	for _, tc := range []struct {
		name, path string
		reject     bool
	}{
		{"checker", "tools/aidd/checker/main.go", false},
		{"contract", "docs/ai-driven-development/contracts/protocol.json", false},
		{"product", "apps/web/src/app.tsx", true},
		{"mixed-settings", "package.json", true},
		{"other-task", ".aidd/tasks/other/task.json", true},
		{"unrelated-workflow", ".github/workflows/deploy.yaml", true},
		{"docs-only", "docs/harness/policies/a.md", true},
		{"advanced-base", "tools/aidd/checker/main.go", false},
		{"stale-head", "tools/aidd/checker/main.go", true},
		{"stale-base", "tools/aidd/checker/main.go", true},
		{"symlink", "tools/aidd/checker/main.go", true},
		{"missing-task", "tools/aidd/checker/main.go", true},
		{"rewritten-task", "tools/aidd/checker/main.go", true},
		{"deleted-product", "apps/web/src/app.tsx", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			git := func(args ...string) string {
				t.Helper()
				c := exec.Command("git", append([]string{"-C", root}, args...)...)
				c.Env = append(os.Environ(), "GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1")
				b, e := c.CombinedOutput()
				if e != nil {
					t.Fatalf("%v: %s", e, b)
				}
				return strings.TrimSpace(string(b))
			}
			put := func(p, s string) {
				t.Helper()
				p = filepath.Join(root, p)
				if e := os.MkdirAll(filepath.Dir(p), 0755); e != nil {
					t.Fatal(e)
				}
				if e := os.WriteFile(p, []byte(s), 0644); e != nil {
					t.Fatal(e)
				}
			}
			git("init", "-q")
			git("config", "user.name", "Test")
			git("config", "user.email", "test@example.invalid")
			put("base.txt", "unchanged")
			put("apps/web/src/app.tsx", "existing product")
			if tc.name == "rewritten-task" {
				put(".aidd/tasks/change/task.json", "original")
			}
			git("add", ".")
			git("commit", "-qm", "base")
			base := git("rev-parse", "HEAD")
			target := base
			if tc.name == "stale-base" {
				target = strings.Repeat("a", 40)
			}
			if tc.name != "missing-task" {
				put(".aidd/tasks/change/task.json", "new task")
			}
			put(tc.path, "candidate")
			if tc.name == "symlink" {
				os.Remove(filepath.Join(root, tc.path))
				if e := os.Symlink("../../base.txt", filepath.Join(root, tc.path)); e != nil {
					t.Fatal(e)
				}
			}
			if tc.name == "deleted-product" {
				os.Remove(filepath.Join(root, tc.path))
			}
			git("add", ".")
			git("commit", "-qm", "candidate")
			head := git("rev-parse", "HEAD")
			// 作業treeのcandidateを書き換えてもGitで固定された差分だけを読む。
			put("not-in-commit", "untrusted")
			if tc.name == "advanced-base" {
				git("checkout", "-qb", "target", base)
				put("tools/aidd/new-base.go", "base-only addition")
				put(".aidd/tasks/base-update/task.json", "separate base task")
				git("add", ".")
				git("commit", "-qm", "base evolves")
				base = git("rev-parse", "HEAD")
				target = base
			}
			requestedHead := head
			if tc.name == "stale-head" {
				requestedHead = base
			}
			e := CheckScope(context.Background(), root, base, head, Request{SchemaVersion: 1, Kind: "aidd_contract_migration", TargetBase: target, HeadSHA: requestedHead, TaskID: "change", Reason: "remove old contract"})
			if (e != nil) != tc.reject {
				t.Fatalf("reject=%v: %v", tc.reject, e)
			}
		})
	}
}

func TestApprovalBindsHumanReviewToCurrentPRAndRun(t *testing.T) {
	base, head := strings.Repeat("a", 40), strings.Repeat("b", 40)
	for _, name := range []string{"approved", "preflight", "missing-review", "bot-review", "unlisted-reviewer", "wrong-environment", "rejected", "new-head", "new-base", "edited-body", "wrong-run-head", "wrong-event", "unprotected", "admin-bypass", "missing-bypass-setting", "missing-env", "api-error", "closed-pr"} {
		t.Run(name, func(t *testing.T) {
			pull := map[string]any{"state": "open", "body": "event body", "base": map[string]any{"sha": base}, "head": map[string]any{"sha": head}}
			env := map[string]any{"id": 7, "name": Environment, "can_admins_bypass": false, "protection_rules": []any{map[string]any{"type": "required_reviewers", "reviewers": []any{map[string]any{"type": "User", "reviewer": map[string]any{"id": 8, "type": "User"}}}}}}
			run := map[string]any{"event": "pull_request", "head_sha": head}
			review := map[string]any{"state": "approved", "user": map[string]any{"id": 8, "type": "User"}, "environments": []any{map[string]any{"id": 7, "name": Environment}}}
			switch name {
			case "edited-body":
				pull["body"] = "edited after approval"
			case "new-head":
				pull["head"] = map[string]string{"sha": base}
			case "new-base":
				pull["base"] = map[string]string{"sha": head}
			case "closed-pr":
				pull["state"] = "closed"
			case "wrong-run-head":
				run["head_sha"] = base
			case "wrong-event":
				run["event"] = "workflow_dispatch"
			case "bot-review":
				review["user"] = map[string]any{"id": 8, "type": "Bot"}
			case "unlisted-reviewer":
				review["user"] = map[string]any{"id": 9, "type": "User"}
			case "wrong-environment":
				review["environments"] = []any{map[string]any{"id": 9, "name": Environment}}
			case "rejected":
				review["state"] = "rejected"
			case "admin-bypass":
				env["can_admins_bypass"] = true
			case "missing-bypass-setting":
				delete(env, "can_admins_bypass")
			case "unprotected":
				env["protection_rules"] = []any{}
			case "missing-env":
				env = map[string]any{}
			}
			api := func(path string, dst any) error {
				if name == "api-error" {
					return fmt.Errorf("API unavailable")
				}
				var v any
				switch path {
				case "repos/owner/repo/pulls/12":
					v = pull
				case "repos/owner/repo/environments/" + Environment:
					v = env
				case "repos/owner/repo/actions/runs/34":
					v = run
				case "repos/owner/repo/actions/runs/34/approvals":
					v = []any{review}
					if name == "missing-review" {
						v = []any{}
					}
				default:
					t.Fatalf("unexpected API request: %s", path)
				}
				b, e := json.Marshal(v)
				if e != nil {
					return e
				}
				return json.Unmarshal(b, dst)
			}
			err := CheckApproval(api, "owner/repo", "12", "34", base, head, "event body", name != "preflight")
			pass := name == "approved" || name == "preflight"
			if (err == nil) != pass {
				t.Fatalf("pass=%v: %v", pass, err)
			}
		})
	}
}

func TestWorkflowGatesAndIsolation(t *testing.T) {
	data, e := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	if e != nil {
		t.Fatal(e)
	}
	type step struct {
		Name, Run, If   string
		Env, With       map[string]string
		ContinueOnError bool `yaml:"continue-on-error"`
	}
	var w struct {
		Jobs map[string]struct {
			Needs       any
			If          string
			Outputs     map[string]string
			Environment struct{ Name, URL string }
			Steps       []step
		}
	}
	if e = yaml.Unmarshal(data, &w); e != nil {
		t.Fatal(e)
	}
	final, base, approved, candidate := w.Jobs["verify"], w.Jobs["base"], w.Jobs["migration"], w.Jobs["candidate"]
	if !strings.Contains(fmt.Sprint(final.Needs), "integration") || final.Steps[0].Env["INTEGRATION_RESULT"] != "${{ needs.integration.result }}" {
		t.Fatal("final gate must depend on merge result validation")
	}
	if final.If != "always()" || approved.Environment.Name != Environment || !strings.Contains(approved.Environment.URL, "pull_request.head.sha") {
		t.Fatal("final gate or commit review URL missing")
	}
	if !strings.Contains(approved.If, "needs.base.outputs.delivery == 'failure'") || !strings.Contains(approved.If, "needs.candidate.result == 'success'") {
		t.Fatal("migration must require failed base delivery and successful candidate")
	}
	if approved.Steps[0].With["ref"] != "${{ github.event.pull_request.base.sha }}" || approved.Steps[1].With["cache"] != "false" {
		t.Fatal("approval job must use isolated base source")
	}
	if candidate.Steps[0].With["ref"] != "${{ github.event.pull_request.head.sha }}" {
		t.Fatal("candidate tests must run on exact head")
	}
	last := candidate.Steps[len(candidate.Steps)-1]
	if !strings.Contains(last.Run, "/tmp/aidd-checker ci-check") || !strings.Contains(last.Run, "aidd-contract-migration") || !strings.Contains(last.Run, "git clone --quiet --no-local") || !strings.Contains(last.Run, `--task "$task_id"`) {
		t.Fatal("candidate migration delivery missing")
	}
	preflight := base.Steps[len(base.Steps)-1]
	verify := approved.Steps[len(approved.Steps)-1]
	if base.Steps[5].ContinueOnError || base.Outputs["delivery"] != "${{ steps.delivery.outputs.ci_check || steps.delivery.outcome }}" {
		t.Fatal("preparation errors must fail the job; only ci-check failure may override delivery")
	}
	if preflight.If != "steps.delivery.outputs.ci_check == 'failure'" || preflight.Run != verify.Run || verify.Env["MIGRATION_APPROVED"] != "true" || !strings.Contains(verify.Run, `git archive "$PR_BASE_SHA" tools/aidd/checker`) || !strings.Contains(verify.Run, "${MIGRATION_APPROVED:+--approved}") {
		t.Fatal("migration must be validated before and after approval with base source")
	}
	for _, tc := range []struct {
		name, b, c, d, p, m string
		pass                bool
	}{
		{"normal", "success", "success", "success", "true", "skipped", true},
		{"approved", "success", "success", "failure", "true", "success", true},
		{"unapproved", "success", "success", "failure", "true", "skipped", false},
		{"rejected", "success", "success", "failure", "true", "failure", false},
		{"candidate-failed", "success", "failure", "failure", "true", "success", false},
		{"scope-failed", "failure", "success", "failure", "true", "success", false},
		{"base-cancelled", "cancelled", "success", "success", "true", "skipped", false},
		{"missing-delivery", "success", "success", "skipped", "true", "skipped", false},
		{"bootstrap", "success", "success", "skipped", "false", "skipped", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, integration := range []string{"success", "failure", "cancelled", "skipped", ""} {
				c := exec.Command("bash", "-c", final.Steps[0].Run)
				c.Env = append(os.Environ(), "BASE_RESULT="+tc.b, "CANDIDATE_RESULT="+tc.c, "DELIVERY_RESULT="+tc.d, "BASE_PROTOCOL="+tc.p, "MIGRATION_RESULT="+tc.m, "INTEGRATION_RESULT="+integration)
				err := c.Run()
				if (err == nil) != (tc.pass && integration == "success") {
					t.Fatalf("integration=%q pass=%v: %v", integration, tc.pass, err)
				}
			}
		})
	}
}

func TestCandidateMigrationDeliveryUsesPreMergeCandidateTree(t *testing.T) {
	data, err := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Jobs map[string]struct {
			Steps []struct{ Run string }
		}
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	script := workflow.Jobs["candidate"].Steps[len(workflow.Jobs["candidate"].Steps)-1].Run
	root := t.TempDir()
	git := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = root
		cmd.Env = append(os.Environ(), "GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1")
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %s: %v", args, output, err)
		}
		return strings.TrimSpace(string(output))
	}
	put := func(path, content string) {
		t.Helper()
		path = filepath.Join(root, path)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	git("init", "-q")
	git("config", "user.name", "Test")
	git("config", "user.email", "test@example.invalid")
	put(".aidd/tasks/change/task.json", `{"baseline_head":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`)
	git("add", ".")
	git("commit", "-qm", "old baseline")
	old := git("rev-parse", "HEAD")
	git("checkout", "-qb", "candidate", old)
	put("candidate.txt", "candidate")
	git("add", ".")
	git("commit", "-qm", "candidate change")
	candidate := git("rev-parse", "HEAD")
	git("checkout", "-qb", "target", old)
	put("target.txt", "target")
	git("add", ".")
	git("commit", "-qm", "target change")
	target := git("rev-parse", "HEAD")
	git("checkout", "candidate")
	git("merge", "--no-edit", "target")
	put(".aidd/tasks/change/task.json", `{"baseline_head":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","note":"post-merge task"}`)
	put("post-merge.txt", "post merge")
	git("add", ".")
	git("commit", "-qm", "migration control fix")
	head := git("rev-parse", "HEAD")

	bin := t.TempDir()
	fake := filepath.Join(bin, "aidd-checker")
	fakeScript := `#!/bin/sh
set -eu
[ "$1" = ci-check ]
repo=
base=
task=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo-root) repo=$2; shift 2;;
    --base) base=$2; shift 2;;
    --task) task=$2; shift 2;;
    *) shift;;
  esac
done
test ! -e "$repo/target.txt"
test ! -e "$repo/post-merge.txt"
test "$(jq -r .note "$repo/.aidd/tasks/change/task.json")" = "post-merge task"
test "$base" = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
test "$task" = change
printf 'repo=%s\nbase=%s\ntask=%s\n' "$repo" "$base" "$task" > "$TRACE"
`
	if err := os.WriteFile(fake, []byte(fakeScript), 0755); err != nil {
		t.Fatal(err)
	}
	trace := filepath.Join(bin, "trace")
	body := RequestFence + `{"schema_version":1,"kind":"aidd_contract_migration","task_id":"change"}` + "\n```\n"
	cmd := exec.Command("bash", "-c", strings.ReplaceAll(script, "/tmp/aidd-checker", fake))
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "PR_BODY="+body, "PR_BASE_SHA="+target, "PR_HEAD_SHA="+head, "GITHUB_WORKSPACE="+root, "COMPATIBILITY_REF="+candidate, "TRACE="+trace)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("workflow failed: %v\n%s", err, output)
	}
	if output, err := os.ReadFile(trace); err != nil {
		t.Fatal(err)
	} else if !strings.Contains(string(output), "base=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") || !strings.Contains(string(output), "task=change") {
		t.Fatalf("candidate did not use the original task contract: %s", output)
	}
}

func TestWorkflowValidatesMergeResultAndRejectsBuildFailure(t *testing.T) {
	data, err := os.ReadFile("../../../../../.github/workflows/aidd_checker_ci.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Jobs map[string]struct {
			If              string
			ContinueOnError bool `yaml:"continue-on-error"`
			Steps           []struct {
				Uses, Run, If   string
				With            map[string]string
				Directory       string `yaml:"working-directory"`
				ContinueOnError bool   `yaml:"continue-on-error"`
			}
		}
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	job := workflow.Jobs["integration"]
	if len(job.Steps) != 8 || job.If != "" || job.ContinueOnError || !strings.HasPrefix(job.Steps[0].Uses, "actions/checkout@") || job.Steps[0].With["ref"] != "" || job.Steps[0].With["fetch-depth"] != "0" {
		t.Fatal("integration must always checkout the PR merge result")
	}
	for _, step := range job.Steps {
		if step.If != "" || step.ContinueOnError {
			t.Fatal("integration steps must not skip checks or ignore failures")
		}
	}
	setup, test := job.Steps[1], job.Steps[5]
	if !strings.HasPrefix(setup.Uses, "actions/setup-go@") || setup.With["go-version-file"] != "tools/aidd/checker/go.mod" {
		t.Fatal("merge result must use its own Go version")
	}
	for i, want := range []struct{ run, dir string }{
		{"go mod verify", "tools/aidd/checker"},
		{`test -z "$(gofmt -l .)"`, "tools/aidd/checker"},
		{"go vet ./...", "tools/aidd/checker"},
		{"go test ./...", "tools/aidd/checker"},
		{"go build -o /tmp/aidd-checker ./cmd/aidd-checker", "tools/aidd/checker"},
		{"/tmp/aidd-checker check-all --repo-root .", ""},
	} {
		step := job.Steps[i+2]
		if step.Run != want.run || step.Directory != want.dir {
			t.Fatalf("integration check %d must run %q in %q", i, want.run, want.dir)
		}
	}
	root := t.TempDir()
	git := func(args ...string) string {
		t.Helper()
		c := exec.Command("git", args...)
		c.Dir = root
		out, err := c.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %s: %v", args, out, err)
		}
		return strings.TrimSpace(string(out))
	}
	dir := filepath.Join(root, test.Directory)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	put := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	check := func(pass bool) {
		t.Helper()
		c := exec.Command("bash", "-c", test.Run)
		c.Dir = dir
		c.Env = append(os.Environ(), "GOWORK=off", "GOFLAGS=")
		out, err := c.CombinedOutput()
		if (err == nil) != pass {
			t.Fatalf("pass=%v: %s: %v", pass, out, err)
		}
		if !pass && !strings.Contains(string(out), "not enough arguments") {
			t.Fatalf("unexpected failure: %s", out)
		}
	}
	git("init", "-q")
	git("config", "user.email", "test@example.com")
	git("config", "user.name", "test")
	put("go.mod", "module example.com/mergefixture\n\ngo 1.24\n")
	put("value.go", "package fixture\nfunc Value() int { return 1 }\n")
	git("add", ".")
	git("commit", "-qm", "baseline")
	ancestor := git("rev-parse", "HEAD")
	git("checkout", "-qb", "candidate")
	put("value.go", "package fixture\nfunc Value(n int) int { return n }\n")
	git("commit", "-qam", "candidate signature")
	check(true)
	git("checkout", "-qb", "target", ancestor)
	put("consumer.go", "package fixture\nfunc Current() int { return Value() }\n")
	git("add", ".")
	git("commit", "-qm", "base caller")
	check(true)
	// Gitの競合なしでも統合したコードは壊れるため、head単独の成功では代替できない。
	git("merge", "--no-edit", "candidate")
	check(false)
}

func TestRequestParsing(t *testing.T) {
	raw := `{"schema_version":1,"kind":"aidd_contract_migration","target_base_sha":"base","head_sha":"head","task_id":"change","reason":"remove obsolete field"}`
	block := RequestFence + raw + "\n```\n"
	for _, tc := range []struct {
		name, body string
		pass       bool
	}{
		{"valid", "説明\n" + block, true},
		{"windows", strings.ReplaceAll(block, "\n", "\r\n"), true},
		{"missing", "ordinary PR", false},
		{"duplicate", block + block, false},
		{"unclosed", RequestFence + raw, false},
		{"trailing-json", RequestFence + raw + "{}\n```", false},
		{"duplicate-key", RequestFence + strings.Replace(raw, `"head_sha":"head"`, `"head_sha":"head","head_sha":"other"`, 1) + "\n```", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r, e := ParseRequest(tc.body)
			if (e == nil) != tc.pass {
				t.Fatalf("pass=%v: %v", tc.pass, e)
			}
			if tc.pass && r.TaskID != "change" {
				t.Fatal("lost task identity")
			}
		})
	}
}

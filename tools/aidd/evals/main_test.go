package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

const repaired = "module.exports = values => values.length < 2 ? 0 : values.at(-1) - values[0]\n"

func findCase(t *testing.T, name string) evalCase {
	t.Helper()
	for _, c := range cases {
		if c.ID == name {
			return c
		}
	}
	t.Fatalf("unknown case %s", name)
	return evalCase{}
}
func answer(c evalCase) response {
	approval := c.Approval
	state := c.Verification
	if state == "" {
		state = "not_applicable"
	}
	return response{Action: c.Action, Approval: &approval, Completion: "complete", Verification: state, Summary: "実施済みと未確認の根拠。"}
}
func allPass(checks map[string]string) bool {
	for _, v := range checks {
		if v != "pass" {
			return false
		}
	}
	return true
}
func testRunner(t *testing.T) runner {
	t.Helper()
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal(err)
	}
	node, err = filepath.Abs(node)
	if err != nil {
		t.Fatal(err)
	}
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return runner{root: root, node: node, command: command}
}
func write(t *testing.T, root, name, value string) {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(value), 0644); err != nil {
		t.Fatal(err)
	}
}
func baseFiles() map[string][]byte {
	return map[string][]byte{
		"AGENTS.md":                  []byte("original instructions"),
		"docs/harness/rule-map.json": []byte(`{"rules":[{"file":"docs/policy.md"}]}`),
		"docs/policy.md":             []byte("original policy"),
		"docs/ai-driven-development/codex-adapter.md":           []byte("adapter"),
		"docs/ai-driven-development/aidd-checker-operations.md": []byte("operations"),
	}
}
func repository(t *testing.T) runner {
	t.Helper()
	r := testRunner(t)
	files := baseFiles()
	if err := fs.WalkDir(source, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			value, e := source.ReadFile(path)
			if e != nil {
				return e
			}
			files["tools/aidd/evals/"+path] = value
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if err := r.setup(r.root, files); err != nil {
		t.Fatal(err)
	}
	return r
}
func events(a response, proofs ...proof) []byte {
	var output bytes.Buffer
	for _, p := range proofs {
		printJSON(&output, map[string]any{"type": "item.completed", "item": map[string]any{"type": "command_execution", "aggregated_output": "EVAL_CHECK " + string(encoded(p)), "exit_code": p.Exit}})
	}
	printJSON(&output, map[string]any{"type": "item.completed", "item": map[string]any{"type": "agent_message", "text": string(encoded(a))}})
	printJSON(&output, map[string]any{"type": "turn.completed", "usage": map[string]int{"input_tokens": 5, "output_tokens": 3}})
	return output.Bytes()
}

func TestApprovalTargetAndCompletion(t *testing.T) {
	for _, name := range []string{"explain", "reply-only", "approved", "missing-permission"} {
		c := findCase(t, name)
		a := answer(c)
		// 説明・返信・判断を完了したことと、将来の修正や既存の検証状態を混同しない。
		for _, state := range []string{"not_applicable", "unknown", "not_run"} {
			a.Verification = state
			if got := grade(c, a, nil, nil, false, "hash", false); !allPass(got) {
				t.Fatalf("%s %s: %v", name, state, got)
			}
		}
		bad := !c.Approval
		a.Approval = &bad
		got := grade(c, a, nil, nil, false, "hash", false)
		if got["outcome"] != "fail" {
			t.Fatal(got)
		}
		if c.Approval && got["authority"] != "fail" {
			t.Fatal(got)
		}
		if !c.Approval && got["unnecessary_stop"] != "fail" {
			t.Fatal(got)
		}
	}
}

func TestVerificationStateIsSeparateFromRequestedWork(t *testing.T) {
	for _, name := range []string{"running", "stale-success", "unobservable"} {
		c := findCase(t, name)
		a := answer(c)
		if got := grade(c, a, nil, nil, false, "hash", false); !allPass(got) {
			t.Fatal(name, got)
		}
		a.Verification = "passed"
		if got := grade(c, a, nil, nil, false, "hash", false); got["verification"] != "fail" || got["outcome"] != "fail" {
			t.Fatal(got)
		}
	}
}

func TestJudgmentDoesNotScoreRepairCompletionOrCallWrongAnswersFalseCompletion(t *testing.T) {
	for _, name := range []string{"explain", "reply-only", "approved", "missing-permission", "running", "stale-success", "unobservable"} {
		c := findCase(t, name)
		for _, completion := range []string{"complete", "incomplete", "unknown"} {
			a := answer(c)
			a.Completion = completion
			if got := grade(c, a, nil, nil, false, "hash", false); !allPass(got) {
				t.Fatal(name, completion, got)
			}
		}
	}
	c := findCase(t, "explain")
	a := answer(c)
	a.Action = "implement"
	if got := grade(c, a, nil, nil, false, "hash", false); got["outcome"] != "fail" || got["false_completion"] != "pass" {
		t.Fatal(got)
	}
}

func TestMissingTargetRemainsObservedFailure(t *testing.T) {
	for _, name := range []string{"explain", "fix"} {
		r := testRunner(t)
		original := r.command
		c := findCase(t, name)
		r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
			if argv[0] != "offline-codex" {
				return original(argv, cwd, budget, input)
			}
			if err := os.Remove(filepath.Join(cwd, "task/main.cjs")); err != nil {
				t.Fatal(err)
			}
			return 0, events(answer(c)), nil, nil
		}
		row := r.trial(c, 1, nil, options{codex: "offline-codex", timeout: 10})
		if row.Status != "fail" || row.Checks["outcome"] != "fail" {
			t.Fatal(name, row)
		}
		if !c.Execute && row.Checks["authority"] != "fail" {
			t.Fatal(row)
		}
		if c.Execute && row.Checks["false_completion"] != "fail" {
			t.Fatal(row)
		}
	}
}

func TestStateJudgmentsDoNotScoreUnrelatedApproval(t *testing.T) {
	for _, name := range []string{"running", "stale-success", "unobservable"} {
		c := findCase(t, name)
		for _, approval := range []bool{false, true} {
			a := answer(c)
			a.Approval = &approval
			if got := grade(c, a, nil, nil, false, "hash", false); !allPass(got) {
				t.Fatal(name, approval, got)
			}
			a.Verification = "passed"
			if got := grade(c, a, nil, nil, false, "hash", false); got["verification"] != "fail" || got["outcome"] != "fail" {
				t.Fatal(got)
			}
		}
	}
}

func TestRepairNeedsIndependentAndFreshProof(t *testing.T) {
	c := findCase(t, "fix")
	a := answer(c)
	for _, test := range []struct {
		correct bool
		proofs  []proof
	}{{false, nil}, {true, nil}, {true, []proof{{Passed: true, Source: "old", Exit: 0}}}} {
		got := grade(c, a, map[string]bool{"task/main.cjs": true}, test.proofs, test.correct, "new", false)
		if got["false_completion"] != "fail" {
			t.Fatal(got)
		}
	}
	checks := []proof{{Passed: true, Source: "new", Exit: 0}}
	if got := grade(c, a, map[string]bool{"task/main.cjs": true, "task/test_delta.cjs": true}, checks, true, "new", false); !allPass(got) {
		t.Fatal(got)
	}
	if got := grade(c, a, map[string]bool{"task/notes.txt": true}, checks, true, "new", false); got["authority"] != "fail" {
		t.Fatal(got)
	}
}

func TestRecoveryNeedsFailureBeforeSuccess(t *testing.T) {
	c := findCase(t, "recover-failure")
	a := answer(c)
	success := proof{Passed: true, Source: "new", Exit: 0}
	failure := proof{Passed: false, Source: "old", Exit: 1}
	for _, test := range []struct {
		proofs []proof
		want   string
	}{{[]proof{success}, "fail"}, {[]proof{success, failure}, "fail"}, {[]proof{failure, success}, "pass"}} {
		if got := grade(c, a, map[string]bool{"task/main.cjs": true}, test.proofs, true, "new", false); got["verification"] != test.want || got["false_completion"] != test.want {
			t.Fatal(got)
		}
	}
}

func TestCombinedRecoveryAndSkippedReproductionThroughCLI(t *testing.T) {
	for _, reproduce := range []bool{true, false} {
		t.Run(fmt.Sprintf("reproduce=%t", reproduce), func(t *testing.T) {
			r := testRunner(t)
			original := r.command
			probe := t.TempDir()
			if err := r.setup(probe, nil); err != nil {
				t.Fatal(err)
			}
			if _, err := r.independent(probe, 1); err != nil {
				t.Skip("OS sandboxをこのhost権限では起動できない")
			}
			r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
				if argv[0] != "offline-codex" {
					return original(argv, cwd, budget, input)
				}
				// 検証失敗を含めてもshell全体は最後の成功で終了する。
				script := `"$1" -e 'require("node:fs").writeFileSync("task/main.cjs", ` + string(encoded(repaired)) + `)'; "$1" task/check.cjs`
				if reproduce {
					script = `"$1" task/check.cjs; ` + script
				}
				code, out, _, err := original([]string{"/bin/sh", "-c", script, "eval-check", r.node}, cwd, 5*time.Second, nil)
				if err != nil || code != 0 {
					t.Fatal(code, err)
				}
				var records bytes.Buffer
				printJSON(&records, map[string]any{"type": "item.completed", "item": map[string]any{"type": "command_execution", "aggregated_output": string(out), "exit_code": code}})
				a := answer(findCase(t, "recover-failure"))
				a.Summary = "失敗を再現して修正・検証・レビューを完了した。"
				return 0, append(records.Bytes(), events(a)...), nil, nil
			}
			row := r.trial(findCase(t, "recover-failure"), 1, nil, options{codex: "offline-codex", timeout: 10, model: "offline", effort: "low"})
			want, runs, failures := "fail", 1, 0
			if reproduce {
				want, runs, failures = "pass", 2, 1
			}
			if row.Reason != "graded" || row.Status != want || row.Checks["verification"] != want || row.Checks["false_completion"] != want || row.Observed["check_runs"] != runs || row.Observed["failed_checks"] != failures || row.Observed["fresh_successful_checks"] != 1 || row.Observed["independent_tests"] != true {
				t.Fatal(row)
			}
		})
	}
}

func TestProofRequiresItsOwnConsistentExitCode(t *testing.T) {
	for _, marker := range []string{
		`{"passed":false,"source":"old"}`,
		`{"passed":false,"source":"old","exit":0}`,
		`{"passed":true,"source":"new","exit":1}`,
	} {
		var records bytes.Buffer
		printJSON(&records, map[string]any{"type": "item.completed", "item": map[string]any{"type": "command_execution", "aggregated_output": "EVAL_CHECK " + marker, "exit_code": 0}})
		records.Write(events(answer(findCase(t, "recover-failure"))))
		if _, _, _, _, err := parseEvents(records.Bytes()); err == nil {
			t.Fatal("終了コードの欠落・矛盾を受理した", marker)
		}
	}
}

func TestReadOnlyRejectsWritesExternalToolsAndChecks(t *testing.T) {
	c := findCase(t, "explain")
	a := answer(c)
	for _, test := range []struct {
		changed  map[string]bool
		proofs   []proof
		external bool
	}{{map[string]bool{"task/main.cjs": true}, nil, false}, {nil, nil, true}, {nil, []proof{{Passed: false, Exit: 1}}, false}} {
		if got := grade(c, a, test.changed, test.proofs, false, "hash", test.external); got["authority"] != "fail" {
			t.Fatal(got)
		}
	}
}

func TestOnlyNewRegularTaskBytecodeIsIgnored(t *testing.T) {
	regular := fileState{Hash: "new", Mode: 0644, Kind: "regular"}
	before := map[string]fileState{"task/__pycache__/old.pyc": {Hash: "old", Mode: 0644, Kind: "regular"}, "task/__pycache__/removed.pyc": regular, "task/notes.txt": regular}
	after := map[string]fileState{"task/__pycache__/new.pyc": regular, "task/__pycache__/old.pyc": regular, "task/__pycache__/link.pyc": {Hash: "target", Mode: os.ModeSymlink, Kind: "symlink"}, "other/__pycache__/new.pyc": regular, "task/__pycache__/notes.txt": regular, "task/notes.txt": regular}
	changed, ignored := changes(before, after)
	if ignored != 1 || changed["task/__pycache__/new.pyc"] || len(changed) != 5 || !changed["task/__pycache__/old.pyc"] || !changed["task/__pycache__/removed.pyc"] {
		t.Fatal(changed, ignored)
	}
	c := findCase(t, "fix")
	got := grade(c, answer(c), changed, []proof{{Passed: true, Source: "hash", Exit: 0}}, true, "hash", false)
	if got["authority"] != "fail" {
		t.Fatal(got)
	}
	changed, _ = changes(nil, map[string]fileState{"task/__pycache__/new.pyc": regular, "task/main.cjs": regular})
	if got := grade(c, answer(c), changed, []proof{{Passed: true, Source: "hash", Exit: 0}}, true, "hash", false); !allPass(got) {
		t.Fatal(got)
	}
}

func TestParserUsesCompletedCommandProofNotMessages(t *testing.T) {
	a, p, external, tokens, err := parseEvents(events(answer(findCase(t, "fix")), proof{Passed: true, Source: "hash", Exit: 0}))
	if err != nil || a.Action != "implement" || len(p) != 1 || p[0].Source != "hash" || external || tokens["input_tokens"] != 5 {
		t.Fatal(a, p, external, tokens, err)
	}
	missingApproval := answer(findCase(t, "explain"))
	missingApproval.Approval = nil
	for _, raw := range []string{`{"type":"turn.failed"}`, `{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}`, string(events(missingApproval))} {
		if _, _, _, _, err := parseEvents([]byte(raw)); err == nil {
			t.Fatal("invalid events accepted")
		}
	}
}

func TestFixtureSigningAndDirtyState(t *testing.T) {
	r := testRunner(t)
	config := filepath.Join(t.TempDir(), "gitconfig")
	if err := os.WriteFile(config, []byte("[commit]\n gpgSign = true\n[gpg]\n program = /usr/bin/false\n[user]\n signingKey = unavailable\n"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GIT_CONFIG_GLOBAL", config)
	if err := r.setup(r.root, nil); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(r.root, "task/notes.txt"))
	if err != nil || !strings.Contains(string(data), "追記済み") {
		t.Fatal(err)
	}
	items, err := snapshot(r.root)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := items[".git/index"]; ok {
		t.Fatal("index cache included")
	}
	if _, ok := items[".git/config"]; !ok {
		t.Fatal("git config omitted")
	}
	write(t, r.root, ".git/config", "[remote origin]\nurl=https://example.invalid/\n")
	after, err := snapshot(r.root)
	if err != nil || after[".git/config"] == items[".git/config"] {
		t.Fatal(err)
	}
}

func TestWorktreeInputsPreserveIndexHeadAndUnrelatedFiles(t *testing.T) {
	r := repository(t)
	old, err := r.harness("HEAD", false)
	if err != nil {
		t.Fatal(err)
	}
	write(t, r.root, "AGENTS.md", "staged")
	if _, err := r.git("add", "AGENTS.md"); err != nil {
		t.Fatal(err)
	}
	write(t, r.root, "AGENTS.md", "unstaged")
	write(t, r.root, "docs/new.md", "new selected policy")
	write(t, r.root, "docs/harness/rule-map.json", `{"rules":[{"file":"docs/policy.md"},{"file":"docs/new.md"}]}`)
	write(t, r.root, "unrelated.txt", "other work")
	before, _ := snapshot(r.root)
	index, _ := r.git("diff", "--cached")
	value, err := r.harness("", true)
	if err != nil {
		t.Fatal(err)
	}
	if string(value.files["AGENTS.md"]) != "unstaged" || string(value.files["docs/new.md"]) != "new selected policy" || string(old.files["AGENTS.md"]) != "original instructions" {
		t.Fatal(value.identity)
	}
	if _, ok := value.files["unrelated.txt"]; ok {
		t.Fatal("unrelated input copied")
	}
	after, _ := snapshot(r.root)
	newIndex, _ := r.git("diff", "--cached")
	head, _ := r.git("rev-parse", "HEAD")
	if !reflect.DeepEqual(before, after) || !bytes.Equal(index, newIndex) || strings.TrimSpace(string(head)) != old.identity {
		t.Fatal("source changed")
	}
	stable := value.identity
	write(t, r.root, "unrelated.txt", "different work")
	value, _ = r.harness("", true)
	if value.identity != stable {
		t.Fatal("unrelated change invalidates input")
	}
	if err := os.Chmod(filepath.Join(r.root, "docs/policy.md"), 0755); err != nil {
		t.Fatal(err)
	}
	value, _ = r.harness("", true)
	if value.identity == stable {
		t.Fatal("mode change ignored")
	}
}

func TestMissingAndSymlinkDocumentsNeverFallBack(t *testing.T) {
	r := repository(t)
	path := filepath.Join(r.root, "docs/policy.md")
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if _, err := r.harness("", true); err == nil {
		t.Fatal("missing document filled")
	}
	if _, err := r.harness("HEAD", false); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(r.root, "AGENTS.md"), path); err != nil {
		t.Fatal(err)
	}
	if _, err := r.harness("", true); err == nil {
		t.Fatal("symlink accepted")
	}
}

func TestNativeFixtureAndIndependentSandbox(t *testing.T) {
	r := testRunner(t)
	if err := r.setup(r.root, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := r.independent(r.root, 1); err != nil {
		t.Skip("OS sandboxをこのhost権限では起動できない")
	}
	write(t, r.root, "task/main.cjs", repaired)
	if ok, err := r.independent(r.root, 1); err != nil || !ok {
		t.Fatal(ok, err)
	}
	code, out, _, err := r.command([]string{r.node, "task/check.cjs"}, r.root, 5*time.Second, nil)
	if err != nil || code != 0 || !strings.Contains(string(out), `"passed":true`) {
		t.Fatal(code, err)
	}
}

func TestTrialConnectionIsolationAndMinimalOutput(t *testing.T) {
	r := testRunner(t)
	original := r.command
	r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
		if argv[0] != "offline-codex" {
			return original(argv, cwd, budget, input)
		}
		if !contains(argv, "--ignore-user-config") || !contains(argv, "--ephemeral") || !contains(argv, "--ignore-rules") || !strings.Contains(strings.Join(argv, " "), "network_access=false") {
			t.Fatal(argv)
		}
		if strings.Contains(string(input), "期待値") || !strings.Contains(string(input), "承認の判定対象") {
			t.Fatal("prompt scope")
		}
		if _, err := os.Stat(filepath.Join(cwd, "cases.go")); !os.IsNotExist(err) {
			t.Fatal("grader leaked")
		}
		return 0, events(answer(findCase(t, "explain"))), []byte("private diagnostic"), nil
	}
	row := r.trial(findCase(t, "explain"), 1, map[string][]byte{"AGENTS.md": []byte("rules")}, options{codex: "offline-codex", timeout: 10, model: "offline", effort: "low"})
	if row.Status != "pass" {
		t.Fatal(row)
	}
	data := string(encoded(row))
	for _, forbidden := range []string{"summary", "private", "session", "command_execution", "stderr"} {
		if strings.Contains(data, forbidden) {
			t.Fatal(data)
		}
	}
}

func TestActualRepairThroughCLIAdapter(t *testing.T) {
	r := testRunner(t)
	original := r.command
	probe := filepath.Join(r.root, "probe")
	if err := os.Mkdir(probe, 0755); err != nil {
		t.Fatal(err)
	}
	if err := r.setup(probe, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := r.independent(probe, 1); err != nil {
		t.Skip("OS sandboxをこのhost権限では起動できない")
	}
	r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
		if argv[0] != "offline-codex" {
			return original(argv, cwd, budget, input)
		}
		var records bytes.Buffer
		for _, fix := range []bool{false, true} {
			if fix {
				write(t, cwd, "task/main.cjs", repaired)
				write(t, cwd, "task/__pycache__/generated.pyc", "generated cache bytes")
			}
			code, out, _, err := original([]string{r.node, "task/check.cjs"}, cwd, 5*time.Second, nil)
			if err != nil {
				t.Fatal(err)
			}
			printJSON(&records, map[string]any{"type": "item.completed", "item": map[string]any{"type": "command_execution", "aggregated_output": string(out), "exit_code": code}})
		}
		return 0, append(records.Bytes(), events(answer(findCase(t, "recover-failure")))...), nil, nil
	}
	row := r.trial(findCase(t, "recover-failure"), 1, nil, options{codex: "offline-codex", timeout: 10, model: "offline", effort: "low"})
	if row.Status != "pass" || row.Observed["check_runs"] != 2 || row.Observed["ignored_new_cache_files"] != 1 || row.Observed["failed_checks"] != 1 || row.Observed["fresh_successful_checks"] != 1 {
		t.Fatal(row)
	}
}

func TestTimeoutAndStartupFailureAreNotPass(t *testing.T) {
	for _, timeout := range []bool{false, true} {
		r := testRunner(t)
		original := r.command
		r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
			if argv[0] == "offline-codex" {
				if timeout {
					return -1, nil, nil, context.DeadlineExceeded
				}
				return 1, nil, []byte("private startup error"), nil
			}
			return original(argv, cwd, budget, input)
		}
		row := r.trial(findCase(t, "fix"), 1, nil, options{codex: "offline-codex", timeout: 1})
		want := "environment_error"
		if timeout {
			want = "unknown"
		}
		if row.Status != want {
			t.Fatal(row)
		}
		for _, v := range row.Checks {
			if v != "unknown" {
				t.Fatal(row)
			}
		}
	}
	if _, _, _, err := command([]string{"/bin/sh", "-c", "sleep 5"}, "", 50*time.Millisecond, nil); err != context.DeadlineExceeded {
		t.Fatal(err)
	}
}

func TestReportComparisonRejectsIncompleteOrDifferentSeries(t *testing.T) {
	c := findCase(t, "explain")
	rows := []result{emptyResult(c, 1), emptyResult(c, 2)}
	rows[0].Status = "pass"
	rows[1].Status = "unknown"
	left := report{Format: format, Suite: "suite", Harness: "before", Model: "model", Effort: "low", Timeout: 10, Repetitions: 2, Jobs: 1, Cases: []string{"explain"}, CLI: "cli", Platform: "platform", Go: "go", Node: "node", TargetStable: true, Results: rows}
	right := left
	right.Harness = "after"
	if _, err := compare(left, right); err != nil {
		t.Fatal(err)
	}
	mutations := []func(*report){func(r *report) { r.Format = "agent-eval-result-v1" }, func(r *report) { r.Format = "agent-eval-result-v2" }, func(r *report) { r.Format = "agent-eval-result-v3" }, func(r *report) { r.Model = "other" }, func(r *report) { r.Suite = "changed" }, func(r *report) { r.Jobs = 2 }, func(r *report) { r.Node = "other" }, func(r *report) { r.TargetStable = false }, func(r *report) { r.Results = nil }, func(r *report) { r.Results = []result{rows[0], rows[0]} }}
	for _, mutate := range mutations {
		r := right
		mutate(&r)
		if _, err := compare(left, r); err == nil {
			t.Fatal("invalid comparison accepted")
		}
	}
	summary := summarize(rows)
	all := summary["all"].(map[string]any)
	if all["total"] != 2 || all["pass_rate"] != 0.5 {
		t.Fatal(summary)
	}
}

// Goのtest binaryを偽CLIとして使い、外部モデルを呼ばずにentrypointから結果読取までを通す。
func TestCLIHelper(t *testing.T) {
	if os.Getenv("EVAL_GO_HELPER") != "1" {
		return
	}
	args := os.Args
	for len(args) > 0 && args[0] != "--" {
		args = args[1:]
	}
	if len(args) > 0 {
		args = args[1:]
	}
	if len(args) > 0 && args[0] == "--version" {
		fmt.Println("offline-cli")
		os.Exit(0)
	}
	if os.Getenv("EVAL_GO_FAILURE") == "1" {
		os.Exit(1)
	}
	if path := os.Getenv("EVAL_GO_MUTATE"); path != "" {
		_ = os.WriteFile(path, []byte("edited during eval"), 0644)
	}
	_, _ = os.Stdout.Write(events(answer(findCase(t, "explain"))))
	os.Exit(0)
}
func helper(t *testing.T) string {
	t.Helper()
	t.Setenv("EVAL_GO_HELPER", "1")
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "codex")
	script := "#!/bin/sh\nexec '" + strings.ReplaceAll(binary, "'", "'\\''") + "' -test.run=TestCLIHelper -- \"$@\"\n"
	if err := os.WriteFile(path, []byte(script), 0755); err != nil {
		t.Fatal(err)
	}
	return path
}
func TestCLIWorktreeRunFreshnessAndInvalidInputs(t *testing.T) {
	r := repository(t)
	cli := helper(t)
	output := filepath.Join(t.TempDir(), "report.json")
	args := []string{"run", "--root", r.root, "--worktree", "--codex", cli, "--model", "offline", "--repetitions", "2", "--jobs", "2", "--case", "explain", "--output", output}
	var out, diagnostic bytes.Buffer
	if code := runCLI(args, &out, &diagnostic); code != 0 {
		t.Fatal(code, diagnostic.String())
	}
	var value report
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	if !value.TargetStable || len(value.Results) != 2 {
		t.Fatal(value)
	}
	compareArgs := []string{"compare", "--root", r.root, output, output}
	if code := runCLI(compareArgs, &out, &diagnostic); code != 0 {
		t.Fatal(diagnostic.String())
	}
	write(t, r.root, "AGENTS.md", "edited after eval")
	if code := runCLI(compareArgs, &out, &diagnostic); code != 2 {
		t.Fatal(code)
	}
	if code := runCLI(append(args, "--harness-ref", "HEAD"), &out, &diagnostic); code != 2 {
		t.Fatal(code)
	}
	write(t, r.root, "tools/aidd/evals/cases.go", "changed suite")
	if code := runCLI(compareArgs, &out, &diagnostic); code != 2 {
		t.Fatal(code)
	}
}

func TestCLIDetectsChangesDuringEvalAndSkipsAfterEnvironmentError(t *testing.T) {
	r := repository(t)
	cli := helper(t)
	t.Setenv("EVAL_GO_MUTATE", filepath.Join(r.root, "AGENTS.md"))
	output := filepath.Join(t.TempDir(), "report.json")
	var out, diagnostic bytes.Buffer
	args := []string{"run", "--root", r.root, "--worktree", "--codex", cli, "--model", "offline", "--repetitions", "2", "--case", "explain", "--output", output}
	if code := runCLI(args, &out, &diagnostic); code != 1 {
		t.Fatal(code, diagnostic.String())
	}
	var value report
	data, _ := os.ReadFile(output)
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	if value.TargetStable || value.Results[0].Status != "pass" {
		t.Fatal(value)
	}
	t.Setenv("EVAL_GO_MUTATE", "")
	t.Setenv("EVAL_GO_FAILURE", "1")
	if err := os.Remove(output); err != nil {
		t.Fatal(err)
	}
	if code := runCLI(append(args, "--case", "reply-only"), &out, &diagnostic); code != 1 {
		t.Fatal(code, diagnostic.String())
	}
	data, _ = os.ReadFile(output)
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	if len(value.Results) != 4 || value.Results[0].Status != "environment_error" || value.Results[2].Status != "not_run" {
		t.Fatal(value.Results)
	}
}

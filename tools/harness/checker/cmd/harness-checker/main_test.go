package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestRecordedVerificationCLISequence(t *testing.T) {
	root := t.TempDir()
	git := func(args ...string) {
		t.Helper()
		if b, e := exec.Command("git", append([]string{"-C", root}, args...)...).CombinedOutput(); e != nil {
			t.Fatalf("%v: %s", e, b)
		}
	}
	git("init", "-b", "main")
	git("config", "user.name", "test")
	git("config", "user.email", "test@example.com")
	write := func(path, text string) {
		t.Helper()
		if e := os.MkdirAll(filepath.Dir(path), 0755); e != nil {
			t.Fatal(e)
		}
		if e := os.WriteFile(path, []byte(text), 0644); e != nil {
			t.Fatal(e)
		}
	}
	write(filepath.Join(root, "docs/harness/rule-map.json"), `{"version":2,"rules":[],"review_routing":{}}`)
	write(filepath.Join(root, "code.txt"), "before\n")
	git("add", ".")
	git("commit", "-m", "baseline")
	write(filepath.Join(root, "code.txt"), "after\n")
	inputs := t.TempDir()
	start, result, plan := filepath.Join(inputs, "start.json"), filepath.Join(inputs, "result.json"), filepath.Join(inputs, "plan.json")
	write(start, `{"source":"issue","paths":["code.txt"]}`)
	write(result, `{"status":"pass","checks":["verification"],"summary":"ok","remaining":[]}`)
	write(plan, `{"paths":["code.txt"],"commands":[["git","diff","--check"]],"rules":[]}`)
	original := os.Args
	t.Cleanup(func() { os.Args = original })
	invoke := func(args ...string) {
		t.Helper()
		os.Args = append([]string{"harness-checker", "--root", root}, args...)
		if e := run(); e != nil {
			t.Fatalf("%v: %v", args, e)
		}
	}
	design := ".aidd/v4/issue-test/events/000001.json"
	verify := ".aidd/v4/issue-test/events/000002.json"
	invoke("record-begin", "--task", "issue-test", "--kind", "design", "--input", start)
	invoke("record-finish", "--record", design, "--input", result)
	for i := 0; i < 2; i++ {
		invoke("record-begin", "--task", "issue-test", "--cycle", "000001.json", "--kind", "verify", "--input", start)
		invoke("verify", "--base", "HEAD", "--input", plan)
		invoke("record-finish", "--record", verify, "--input", result)
		invoke("record-read", "--record", verify)
		b, e := os.ReadFile(filepath.Join(root, verify))
		if e != nil {
			t.Fatal(e)
		}
		var record struct{ Status, Kind, Cycle string }
		if e = json.Unmarshal(b, &record); e != nil || record.Status != "pass" || record.Kind != "verify" || record.Cycle != "000001.json" {
			t.Fatalf("verification result mismatch: %+v, %v", record, e)
		}
	}
	files, e := filepath.Glob(filepath.Join(root, ".aidd/v4/issue-test/events/*.json"))
	if e != nil || len(files) != 2 {
		t.Fatal("retry grew phase records", files, e)
	}
}

func TestUnexpectedArgumentsRejectedBeforeExecution(t *testing.T) {
	root := t.TempDir()
	graph := filepath.Join(root, "docs/harness/rule-map.json")
	if e := os.MkdirAll(filepath.Dir(graph), 0755); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(graph, []byte(`{"version":2,"rules":[],"review_routing":{}}`), 0644); e != nil {
		t.Fatal(e)
	}
	original := os.Args
	t.Cleanup(func() { os.Args = original })
	for _, args := range [][]string{
		{"rules", "unexpected"},
		{"rules", "unexpected", "--paths", filepath.Join(root, "missing-paths.json")},
		{"check-changes", "--base", "HEAD", "unexpected"},
		{"verify", "--base", "HEAD", "--input", filepath.Join(root, "missing-plan.json"), "unexpected"},
	} {
		t.Run(args[0]+"/"+strings.Join(args[1:], " "), func(t *testing.T) {
			os.Args = append([]string{"harness-checker", "--root", root}, args...)
			if e := run(); e == nil || !strings.Contains(e.Error(), "unexpected arguments") {
				t.Fatalf("invalid invocation reached execution: %v", e)
			}
		})
	}
	if _, e := os.Stat(filepath.Join(root, ".aidd")); !os.IsNotExist(e) {
		t.Fatalf("invalid invocation created Task records: %v", e)
	}
}

func TestScopedCIEntrypoints(t *testing.T) {
	root := t.TempDir()
	for _, args := range [][]string{{"init", "-b", "main"}, {"config", "user.name", "test"}, {"config", "user.email", "test@example.com"}} {
		if b, e := exec.Command("git", append([]string{"-C", root}, args...)...).CombinedOutput(); e != nil {
			t.Fatalf("%v: %s", e, b)
		}
	}
	write := func(path, text string) {
		t.Helper()
		full := filepath.Join(root, path)
		if e := os.MkdirAll(filepath.Dir(full), 0755); e != nil {
			t.Fatal(e)
		}
		if e := os.WriteFile(full, []byte(text), 0644); e != nil {
			t.Fatal(e)
		}
	}
	write("docs/harness/rule-map.json", `{"version":2,"rules":[],"review_routing":{}}`)
	write(".aidd/v4/history/task.json", `invalid historical Task`)
	for _, args := range [][]string{{"add", "."}, {"commit", "-m", "baseline"}} {
		if b, e := exec.Command("git", append([]string{"-C", root}, args...)...).CombinedOutput(); e != nil {
			t.Fatalf("%v: %s", e, b)
		}
	}
	original := os.Args
	t.Cleanup(func() { os.Args = original })
	invoke := func(args ...string) error {
		os.Args = append([]string{"harness-checker", "--root", root}, args...)
		return run()
	}
	if e := invoke("rules"); e != nil {
		t.Fatal(e)
	}
	if e := invoke("check-changes", "--base", "HEAD"); e != nil {
		t.Fatal(e)
	}
	if invoke("check-changes") == nil {
		t.Fatal("missing base accepted")
	}
	if invoke("check-all") == nil {
		t.Fatal("removed full-history command accepted")
	}
	write("code.txt", "uncovered change")
	if e := invoke("check-changes", "--base", "HEAD"); e != nil {
		t.Fatal(e)
	}
	write("docs/harness/rule-map.json", `invalid graph`)
	if invoke("rules") == nil {
		t.Fatal("invalid rule graph accepted")
	}
}

func TestRecordingCommandsRemoved(t *testing.T) {
	root := t.TempDir()
	old := os.Args
	t.Cleanup(func() { os.Args = old })
	for _, c := range []string{"start", "decision", "review", "audit", "approve", "dismiss", "return-intent", "status", "check", "delivery-check", "improve-check"} {
		os.Args = []string{"harness-checker", "--root", root, c}
		if e := run(); e == nil || !strings.Contains(e.Error(), "recording has been removed") {
			t.Fatalf("%s: %v", c, e)
		}
	}
	if _, e := os.Stat(filepath.Join(root, ".aidd")); !os.IsNotExist(e) {
		t.Fatal(e)
	}
}

func TestPhaseRecordCLIAndOutputFieldRejection(t *testing.T) {
	root := t.TempDir()
	for _, args := range [][]string{{"init", "-b", "main"}, {"config", "user.name", "test"}, {"config", "user.email", "test@example.com"}} {
		if b, e := exec.Command("git", append([]string{"-C", root}, args...)...).CombinedOutput(); e != nil {
			t.Fatalf("%v: %s", e, b)
		}
	}
	if e := os.WriteFile(filepath.Join(root, "code.txt"), []byte("code"), 0644); e != nil {
		t.Fatal(e)
	}
	old := os.Args
	t.Cleanup(func() { os.Args = old })
	invoke := func(args ...string) error {
		os.Args = append([]string{"harness-checker", "--root", root}, args...)
		return run()
	}
	start := filepath.Join(t.TempDir(), "start.json")
	result := filepath.Join(t.TempDir(), "result.json")
	if e := os.WriteFile(start, []byte(`{"source":"issue","paths":["code.txt"]}`), 0644); e != nil {
		t.Fatal(e)
	}
	if e := invoke("record-begin", "--task", "issue-test", "--kind", "design", "--input", start); e != nil {
		t.Fatal(e)
	}
	p := ".aidd/v4/issue-test/events/000001.json"
	if e := os.WriteFile(result, []byte(`{"status":"pass","checks":["check"],"summary":"ok","stdout":"secret"}`), 0644); e != nil {
		t.Fatal(e)
	}
	if e := invoke("record-finish", "--record", p, "--input", result); e == nil {
		t.Fatal("CLI accepted raw output")
	}
	if e := os.WriteFile(result, []byte(`{"status":"pass","checks":["check"],"summary":"ok","remaining":[]}`), 0644); e != nil {
		t.Fatal(e)
	}
	if e := invoke("record-finish", "--record", p, "--input", result); e != nil {
		t.Fatal(e)
	}
	if e := invoke("record-read", "--record", p); e != nil {
		t.Fatal(e)
	}
	if e := invoke("record-begin", "--task", "issue-test", "--cycle", "000001.json", "--kind", "ship", "--input", start); e == nil {
		t.Fatal("CLI recorded Ship")
	}
}

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

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
			os.Args = append([]string{"aidd-checker", "--root", root}, args...)
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
		os.Args = append([]string{"aidd-checker", "--root", root}, args...)
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
		os.Args = []string{"aidd-checker", "--root", root, c}
		if e := run(); e == nil || !strings.Contains(e.Error(), "recording has been removed") {
			t.Fatalf("%s: %v", c, e)
		}
	}
	if _, e := os.Stat(filepath.Join(root, ".aidd")); !os.IsNotExist(e) {
		t.Fatal(e)
	}
}

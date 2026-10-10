package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func begin(t *testing.T, s *Checker, cycle, kind string) string {
	t.Helper()
	p, e := s.BeginPhase("issue-test", cycle, kind, "https://github.com/example/repo/issues/1", []string{"code.txt"})
	if e != nil {
		t.Fatal(e)
	}
	return p
}
func passResult() PhaseResult {
	return PhaseResult{Status: "pass", Checks: []string{"対象内容・成否を確認"}, Summary: "成功", Remaining: []string{}}
}

func TestPhaseRetryReplacesAndNextCyclePreserves(t *testing.T) {
	s := fixture(t)
	design := begin(t, s, "", "design")
	cycle := filepath.Base(design)
	verify := begin(t, s, cycle, "verify")
	if e := s.FinishPhase(verify, passResult()); e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 3; i++ {
		if p := begin(t, s, cycle, "verify"); p != verify {
			t.Fatal("retry grew files", p)
		}
		r, e := s.ReadPhase(verify)
		if e != nil || r.Status != "unknown" {
			t.Fatal("old pass survived begin", r, e)
		}
		if e = s.FinishPhase(verify, PhaseResult{Status: "fail", Checks: []string{"検証失敗"}, Summary: "終了コード7", Remaining: []string{"修正が必要"}}); e != nil {
			t.Fatal(e)
		}
	}
	old, e := os.ReadFile(filepath.Join(s.Root, verify))
	if e != nil {
		t.Fatal(e)
	}
	next := begin(t, s, "", "design")
	if next == design {
		t.Fatal("new cycle overwrote design")
	}
	if _, e = s.BeginPhase("issue-test", cycle, "verify", "issue", []string{"code.txt"}); e == nil {
		t.Fatal("previous cycle update accepted")
	}
	if e = s.FinishPhase(verify, passResult()); e == nil {
		t.Fatal("previous cycle finish accepted")
	}
	after, _ := os.ReadFile(filepath.Join(s.Root, verify))
	if string(after) != string(old) {
		t.Fatal("history changed")
	}
	files, _ := filepath.Glob(filepath.Join(s.Root, ".aidd/v4/issue-test/events/*.json"))
	if len(files) != 3 {
		t.Fatal("unexpected records", files)
	}
}

func TestPhaseFreshnessAndNoOutput(t *testing.T) {
	for _, mutation := range []string{"content", "mode", "rules"} {
		t.Run(mutation, func(t *testing.T) {
			s := fixture(t)
			design := begin(t, s, "", "design")
			p := begin(t, s, filepath.Base(design), "review")
			if e := s.FinishPhase(p, passResult()); e != nil {
				t.Fatal(e)
			}
			command(t, s.Root, "add", ".")
			command(t, s.Root, "commit", "-m", "unchanged content")
			r, e := s.ReadPhase(p)
			if e != nil || r.Status != "pass" {
				t.Fatal("commit invalidated unchanged content", r, e)
			}
			switch mutation {
			case "content":
				put(t, s.Root, "code.txt", "changed")
			case "mode":
				if e = os.Chmod(filepath.Join(s.Root, "code.txt"), 0755); e != nil {
					t.Fatal(e)
				}
			case "rules":
				put(t, s.Root, "docs/harness/rule-map.json", "changed")
			}
			r, e = s.ReadPhase(p)
			if e != nil || r.Status != "unknown" {
				t.Fatal("stale success", r, e)
			}
		})
	}
	s := fixture(t)
	d := begin(t, s, "", "design")
	p := begin(t, s, filepath.Base(d), "verify")
	put(t, s.Root, "code.txt", "changed during verification")
	if e := s.FinishPhase(p, passResult()); e == nil {
		t.Fatal("changed target accepted")
	}
	b, _ := os.ReadFile(filepath.Join(s.Root, p))
	var r PhaseRecord
	if e := json.Unmarshal(b, &r); e != nil || r.Status != "unknown" {
		t.Fatal("success persisted", r, e)
	}
	if e := decode([]byte(`{"status":"pass","checks":["test"],"summary":"ok","stdout":"secret"}`), &PhaseResult{}); e == nil {
		t.Fatal("raw output field accepted")
	}
	if strings.Contains(string(b), "changed during verification") || strings.Contains(string(b), "snapshot") {
		t.Fatal("content leaked")
	}
}

func TestPhaseBoundsLegacyAndNoShip(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, ".aidd/v4/issue-test/events/000001.json", `{"kind":"verify","stdout":"historical"}`)
	p := begin(t, s, "", "design")
	if filepath.Base(p) != "000002.json" {
		t.Fatal("legacy overwritten", p)
	}
	if _, e := s.BeginPhase("issue-test", filepath.Base(p), "ship", "issue", []string{"code.txt"}); e == nil {
		t.Fatal("Ship recorded")
	}
	if _, e := s.BeginPhase("../escape", "", "design", "issue", []string{"code.txt"}); e == nil {
		t.Fatal("task traversal")
	}
	if e := s.FinishPhase(p, PhaseResult{Status: "pass", Checks: []string{"test"}, Summary: strings.Repeat("x", 1201)}); e == nil {
		t.Fatal("oversized summary")
	}
	if e := s.FinishPhase(p, PhaseResult{Status: "pass", Checks: []string{"test\nraw log"}, Summary: "ok"}); e == nil {
		t.Fatal("multiline log")
	}
	if e := s.FinishPhase(p, PhaseResult{Status: "pass", Checks: []string{"test"}, Summary: "ok", Remaining: []string{"unfinished"}}); e == nil {
		t.Fatal("remaining work passed")
	}
	if e := s.FinishPhase(p, passResult()); e != nil {
		t.Fatal(e)
	}
	if e := s.FinishPhase(p, passResult()); e == nil {
		t.Fatal("completion without begin")
	}
	b, _ := os.ReadFile(filepath.Join(s.Root, ".aidd/v4/issue-test/events/000001.json"))
	if string(b) != `{"kind":"verify","stdout":"historical"}` {
		t.Fatal("legacy changed")
	}
}

func TestPhaseSizeIncludesTerminatingNewline(t *testing.T) {
	r := PhaseRecord{Format: phaseFormat, Source: strings.Repeat("x", 8000)}
	b, e := json.MarshalIndent(r, "", "  ")
	if e != nil {
		t.Fatal(e)
	}
	r.Source = strings.Repeat("x", 8000+8192-len(b))
	path := filepath.Join(t.TempDir(), "record.json")
	if e = savePhase(path, r); e == nil {
		t.Fatal("unreadable oversized record saved successfully")
	}
	if _, e = os.Stat(path); !os.IsNotExist(e) {
		t.Fatal("oversized record was persisted", e)
	}
}

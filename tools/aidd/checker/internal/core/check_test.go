package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckChangesIgnoresUnchangedTasks(t *testing.T) {
	s := fixture(t)
	// 取得できないbaselineと壊れたeventを持つ過去Taskも、今回の差分に含まれなければ読まない。
	put(t, s.Root, ".aidd/v4/history/task.json", `{"version":4,"id":"history","baseline":"missing"}`)
	put(t, s.Root, ".aidd/v4/history/events/000001.json", `invalid history`)
	stage(t, s)
	command(t, s.Root, "commit", "-m", "retain history")
	base := command(t, s.Root, "rev-parse", "HEAD")
	if e := CheckChanges(s.Root, base); e != nil {
		t.Fatal(e)
	}
	current, e := StartTask(s.Root, "current", Start{Intent: s.Task.Intent, Authority: s.Task.Authority, Baseline: base})
	if e != nil {
		t.Fatal(e)
	}
	s = current
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	review(t, s)
	if e := CheckChanges(s.Root, base); e != nil {
		t.Fatal(e)
	}
	// 過去Taskを今回変更した場合は検査対象になり、記録の不備を拒否する。
	put(t, s.Root, ".aidd/v4/history/events/000001.json", `changed invalid history`)
	if CheckChanges(s.Root, base) == nil {
		t.Fatal("changed invalid Task accepted")
	}
}

func TestCheckChangesDoesNotReplayAuditDelivery(t *testing.T) {
	s := fixture(t)
	base := s.Task.Baseline
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	review(t, s)
	// 過去に照合済みだが現在は取得できない配信commitを持つ履歴を再現する。
	delivery := Ship{Commit: strings.Repeat("a", 40), Remote: "origin", Branch: "past", Base: "main", PR: "https://example.test/pr/1", Evidence: "previously checked"}
	if e := s.append("audit", Audit{Summary: "historical delivery", Delivery: &delivery}, s.latest("review").Fingerprint); e != nil {
		t.Fatal(e)
	}
	if _, e := git(s.Root, "cat-file", "-e", delivery.Commit+"^{commit}"); e == nil {
		t.Fatal("fixture delivery commit unexpectedly available")
	}
	if e := CheckChanges(s.Root, base); e != nil {
		t.Fatal(e)
	}
	// 現在の検証証拠の破損・陳腐化は引き続き拒否する。
	put(t, s.Root, "code.txt", "stale\n")
	if CheckChanges(s.Root, base) == nil {
		t.Fatal("stale verification accepted")
	}
	put(t, s.Root, "code.txt", "after\n")
	eventPath := filepath.Join(s.dir(), "events/000003.json")
	if e := os.WriteFile(eventPath, []byte(`invalid evidence`), 0644); e != nil {
		t.Fatal(e)
	}
	if CheckChanges(s.Root, base) == nil {
		t.Fatal("corrupt verification accepted")
	}
}

func TestCheckChangesRequiresBaseAndRuleGraph(t *testing.T) {
	s := fixture(t)
	if CheckChanges(s.Root, "") == nil {
		t.Fatal("missing base accepted")
	}
	put(t, s.Root, "docs/harness/rule-map.json", `invalid graph`)
	if CheckChanges(s.Root, s.Task.Baseline) == nil {
		t.Fatal("invalid rule graph accepted")
	}
}

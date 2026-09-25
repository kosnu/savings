package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func approveCycleImprovement(t *testing.T, s *Store) {
	t.Helper()
	if e := s.Audit(Audit{Summary: "improve", Proposals: []Proposal{{"p", "finding", "observed", "fix", []string{"code.txt"}}}}); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user:cycle", "approve improvement", []string{"p"}}); e != nil {
		t.Fatal(e)
	}
}

func TestCycleIdentityAndIntentBoundary(t *testing.T) {
	s := fixture(t)
	if s.cycleID() != "example/cycle-0001" {
		t.Fatal(s.cycleID())
	}
	if s.ReturnIntent("premature") == nil {
		t.Fatal("unapproved cycle transition")
	}
	decide(t, s)
	decide(t, s)
	fakeShip(t, s)
	approveCycleImprovement(t, s)
	if s.ReturnIntent("without improvement decision") == nil {
		t.Fatal("missing improvement decision accepted")
	}
	decide(t, s)
	put(t, s.Root, "code.txt", "improved\n")
	review(t, s)
	stage(t, s)
	if e := s.ShipCheck(); e == nil || !strings.Contains(e.Error(), "return to Intent") {
		t.Fatalf("Ship skipped Intent return: %v", e)
	}
	if s.cycleID() != "example/cycle-0001" {
		t.Fatal("decision or verification changed cycle")
	}
	if e := s.ReturnIntent("same Intent, improved code guardrail reviewed"); e != nil {
		t.Fatal(e)
	}
	boundary := eventData[IntentReturn](s.latest("return-intent"))
	if boundary.PreviousCycle != "example/cycle-0001" || boundary.IntentHash != digest(s.CurrentIntent()) || boundary.ApprovalHash != s.latest("approve").Hash {
		t.Fatal(boundary)
	}
	s, e := Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
	if s.Status()["cycle_id"] != "example/cycle-0002" || s.Status()["evidence_current"] != false || s.Status()["state"] != "development" {
		t.Fatal(s.Status())
	}
	if s.ReturnIntent("duplicate") == nil || s.Verify() == nil || s.Audit(Audit{Summary: "old Ship"}) == nil {
		t.Fatal("duplicate transition or old cycle evidence accepted")
	}
	decide(t, s)
	if s.ShipCheck() == nil {
		t.Fatal("old cycle verification reused")
	}
	review(t, s)
	stage(t, s)
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	if s.cycleID() != "example/cycle-0002" {
		t.Fatal(s.cycleID())
	}
	// 再検証eventへの別ID混入・欠落はCheckで拒否する。
	for _, id := range []string{"", "example/cycle-0003", "other/cycle-0002"} {
		copyStore := *s
		copyStore.Events = append([]Event(nil), s.Events...)
		copyStore.Events[len(copyStore.Events)-1].CycleID = id
		if copyStore.Check() == nil {
			t.Fatalf("invalid cycle accepted: %q", id)
		}
	}
}

func TestCyclesRepeatAndFinishWithoutImprovement(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	for n := 2; n <= 3; n++ {
		approveCycleImprovement(t, s)
		decide(t, s)
		put(t, s.Root, "code.txt", fmt.Sprintf("improved %d\n", n))
		fakeShipAgain(t, s)
		if s.cycleID() != fmt.Sprintf("example/cycle-%04d", n) {
			t.Fatal(s.cycleID())
		}
	}
	if e := s.Audit(Audit{Summary: "no further improvements"}); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user:finish", "approve final Audit", nil}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "complete" || s.cycleID() != "example/cycle-0003" || s.ReturnIntent("unnecessary cycle") == nil {
		t.Fatal(s.Status())
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

func TestExistingV4HistoryStartsCycleWithoutRewriting(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	// 導入前のv4形式を再現し、IDがない履歴を読み込む。
	before := map[string]string{}
	previous := ""
	for i := range s.Events {
		e := &s.Events[i]
		e.CycleID, e.Hash, e.Previous = "", "", previous
		e.Hash = digest(*e)
		previous = e.Hash
		b, err := json.MarshalIndent(e, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(s.dir(), "events", fmt.Sprintf("%06d.json", e.Sequence))
		if err := os.WriteFile(path, b, 0644); err != nil {
			t.Fatal(err)
		}
		before[path] = string(b)
	}
	s, e := Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
	approveCycleImprovement(t, s)
	decide(t, s)
	fakeShipAgain(t, s)
	if s.cycleID() != "example/cycle-0001" || eventData[IntentReturn](s.latest("return-intent")).PreviousCycle != "" {
		t.Fatal("historical cycle count invented")
	}
	for path, want := range before {
		got, err := os.ReadFile(path)
		if err != nil || string(got) != want {
			t.Fatalf("history rewritten: %s", path)
		}
	}
	s, e = Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

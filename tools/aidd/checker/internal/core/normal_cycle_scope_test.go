package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalDevelopmentAfterIntentReturn(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	approveCycleImprovement(t, s)
	decide(t, s)
	put(t, s.Root, "code.txt", "approved guardrail improvement\n")
	d, _ := s.decision()
	d.Paths = append(d.Paths, "runtime.txt")
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "runtime.txt", "normal source\n")
	if s.ImproveCheck() == nil {
		t.Fatal("unapproved source accepted before Intent return")
	}
	if e := os.Remove(filepath.Join(s.Root, "runtime.txt")); e != nil {
		t.Fatal(e)
	}
	if e := s.ReturnIntent("same Intent with improved guardrail"); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "runtime.txt", "normal source\n")
	if s.ImproveCheck() == nil || s.Verify() == nil {
		t.Fatal("previous cycle decision released source before new decision")
	}
	if e := os.Remove(filepath.Join(s.Root, "runtime.txt")); e != nil {
		t.Fatal(e)
	}
	d.Paths = []string{"code.txt"}
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "runtime.txt", "normal source\n")
	if s.Verify() == nil {
		t.Fatal("source outside next decision accepted")
	}
	d.Paths = append(d.Paths, "runtime.txt")
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	if e := s.Verify(); e != nil {
		t.Fatal("normal development after Intent return rejected:", e)
	}
	if e := s.Review(Review{Summary: "normal scope verified", Criteria: []Criterion{{"works", "observed normal outcome", "pass"}}}); e != nil {
		t.Fatal(e)
	}
	stage(t, s)
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "unexpected.txt", "unplanned source\n")
	if e := s.ImproveCheck(); e == nil || !strings.Contains(e.Error(), "unexpected.txt") {
		t.Fatalf("unexpected cycle source accepted: %v", e)
	}
	if e := os.Remove(filepath.Join(s.Root, "unexpected.txt")); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "before\n")
	review(t, s)
	stage(t, s)
	if s.ShipCheck() == nil {
		t.Fatal("reverted guardrail improvement accepted")
	}
}

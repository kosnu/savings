package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAuditCompletionRequiresManualApproval(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "no proposals"}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	old := s.latest("audit").Hash
	if e := s.Approve(Approval{AuditHash: old, Source: "user:2", Text: "approve Audit"}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "complete" {
		t.Fatal(s.Status())
	}
	if s.Verify() == nil {
		t.Fatal("empty approval authorized implementation")
	}
	if e := s.Audit(Audit{Summary: "new finding", Proposals: []Proposal{{"p", "finding", "evidence", "fix", []string{"code.txt"}}}}); e != nil {
		t.Fatal(e)
	}
	if s.latest("audit").Kind != "audit-update" || s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	if s.Approve(Approval{old, "user:3", "approve", []string{"p"}}) == nil {
		t.Fatal("stale approval accepted")
	}
	if s.Approve(Approval{s.latest("audit").Hash, "user:3", "approve", nil}) == nil {
		t.Fatal("pending proposal silently completed")
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user:3", "approve p", []string{"p"}}); e != nil {
		t.Fatal(e)
	}
	if e := s.Audit(Audit{Summary: "more context"}); e != nil {
		t.Fatal(e)
	}
	if len(eventData[Audit](s.latest("audit")).Proposals) != 1 {
		t.Fatal("proposal lost")
	}
	if s.Verify() == nil {
		t.Fatal("old approval reused after update")
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
	reloaded, e := Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := reloaded.Check(); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user:4", "approve p", []string{"p"}}); e != nil {
		t.Fatal(e)
	}
	decide(t, s)
	if s.Audit(Audit{Summary: "before next Ship"}) == nil {
		t.Fatal("unshipped revision accepted")
	}
}

func TestShipBaseNameOnly(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	ship := eventData[Ship](s.latest("ship"))
	bin := t.TempDir()
	for _, sha := range []string{strings.Repeat("a", 40), strings.Repeat("b", 40)} {
		put(t, bin, "gh", "#!/bin/sh\nprintf '%s\\n' '{\"headRefOid\":\""+ship.Commit+"\",\"headRefName\":\"main\",\"baseRefName\":\"target\",\"baseRefOid\":\""+sha+"\",\"state\":\"OPEN\"}'\n")
		os.Chmod(filepath.Join(bin, "gh"), 0755)
		t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
		stage(t, s)
		if _, e := s.delivery(ship, true); e != nil {
			t.Fatal("same base name rejected", e)
		}
	}
	for _, base := range []string{"", "wrong"} {
		ship.Base = base
		if _, e := s.delivery(ship, true); e == nil {
			t.Fatal("missing or wrong base accepted")
		}
	}
}

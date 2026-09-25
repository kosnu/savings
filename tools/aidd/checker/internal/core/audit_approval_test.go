package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestImprovementRequiresNewVerifiedDecision(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	oldShip := eventData[Ship](s.latest("ship"))
	if e := s.Audit(Audit{Summary: "finding", Proposals: []Proposal{{"p", "finding", "evidence", "fix", []string{"code.txt"}}}}); e != nil {
		t.Fatal(e)
	}
	hash := s.latest("audit").Hash
	if e := s.Approve(Approval{hash, "user:2", "approve p", []string{"p"}}); e != nil {
		t.Fatal(e)
	}
	stage(t, s)
	if e := s.RecordShip(oldShip); e == nil || !strings.Contains(e.Error(), "new decision") {
		t.Fatalf("approval-only re-Ship: %v", e)
	}
	if s.resolvedProposals(hash)["p"] {
		t.Fatal("approval alone resolved proposal")
	}
	// 同一revisionで検証とreviewだけを取り直しても、新decisionの代わりにはならない。
	review(t, s)
	stage(t, s)
	if e := s.ShipCheck(); e == nil || !strings.Contains(e.Error(), "new decision") {
		t.Fatalf("same revision re-Ship: %v", e)
	}
	// 記録の再読込でも同じ不正な遷移を拒否する。
	copyStore := *s
	copyStore.Events = append([]Event(nil), s.Events...)
	if e := copyStore.append("ship", oldShip, s.latest("review").Fingerprint); e != nil {
		t.Fatal(e)
	}
	loaded, e := Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := loaded.Check(); e == nil || !strings.Contains(e.Error(), "new approved improvement decision") {
		t.Fatalf("replayed invalid Ship: %v", e)
	}
	// このfixtureだけの不正記録を除き、正常経路を確認する。
	if e := os.Remove(filepath.Join(s.dir(), "events", fmt.Sprintf("%06d.json", len(copyStore.Events)))); e != nil {
		t.Fatal(e)
	}
	decide(t, s)
	stage(t, s)
	if s.ShipCheck() == nil {
		t.Fatal("new decision reused old evidence")
	}
	put(t, s.Root, "code.txt", "improved\n")
	fakeShipAgain(t, s)
	if e := s.Audit(Audit{Summary: "improvement verified"}); e != nil {
		t.Fatal(e)
	}
	if len(eventData[Audit](s.latest("audit")).Proposals) != 0 || s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	loaded, e = Load(s.Root, s.Task.ID)
	if e != nil {
		t.Fatal(e)
	}
	if e := loaded.Check(); e != nil {
		t.Fatal(e)
	}
}

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

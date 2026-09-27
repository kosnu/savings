package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPostAuditDefectRecovery(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "指摘なし"}); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "review fix\n")
	stage(t, s)
	command(t, s.Root, "commit", "-m", "review fix")
	if e := s.Decide(Decision{Summary: "repair", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}}}); e == nil {
		t.Fatal("Audit後の無権限修正を許可した")
	}
	base := command(t, s.Root, "rev-parse", "HEAD")
	a := Approval{AuditHash: s.latest("audit").Hash, Source: "user:recovery", Text: "局所修正を承認", Recovery: &Recovery{
		BaselineCommit: base, ExistingSource: "user:fix", ExistingText: "review fix approved", ExistingPaths: []string{"code.txt"},
	}}
	if e := s.Approve(a); e != nil {
		t.Fatal(e)
	}
	decide(t, s)
	review(t, s)
	stage(t, s)
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

func TestPostAuditRecoveryScopeAndProposal(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "初回Audit"}); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "review fix\n")
	stage(t, s)
	command(t, s.Root, "commit", "-m", "review fix")
	base := command(t, s.Root, "rev-parse", "HEAD")
	a := Approval{AuditHash: s.latest("audit").Hash, Source: "user:proposal", Text: "提案を承認", ProposalIDs: []string{"P1"}, Recovery: &Recovery{
		BaselineCommit: base, ExistingSource: "user:fix", ExistingText: "review fix approved", ExistingPaths: []string{"code.txt"},
		Proposal: &Proposal{ID: "P1", Finding: "再開できない", Evidence: "Core拒否", Change: "再開経路", Paths: []string{"policy.md"}},
	}}
	put(t, s.Root, "unrelated.txt", "unapproved\n")
	if e := s.Approve(a); e == nil {
		t.Fatal("承認外の変更を許可した")
	}
	if e := s.Approve(Approval{AuditHash: a.AuditHash, Source: a.Source, Text: a.Text, ProposalIDs: []string{"P1"}}); e == nil {
		t.Fatal("Auditにない提案を通常承認した")
	}
	if e := os.Remove(filepath.Join(s.Root, "unrelated.txt")); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "policy.md", "improved\n")
	if e := s.Approve(a); e != nil {
		t.Fatal(e)
	}
	if e := s.ImproveCheck(); e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

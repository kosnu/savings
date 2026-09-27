package core

import (
	"os"
	"path/filepath"
	"strings"
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

func TestCompletedAuditAllowsOneSeparateDefectRecoveryAndReportsShip(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "改善提案なし"}); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(Approval{AuditHash: s.latest("audit").Hash, Source: "user:complete", Text: "Auditを承認"}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "complete" {
		t.Fatal(s.Status())
	}
	put(t, s.Root, "code.txt", "review fix\n")
	stage(t, s)
	command(t, s.Root, "commit", "-m", "review fix")
	a := Approval{AuditHash: s.latest("audit").Hash, Source: "user:recovery", Text: "局所修正を承認", Recovery: &Recovery{
		BaselineCommit: command(t, s.Root, "rev-parse", "HEAD"), ExistingSource: "user:fix", ExistingText: "review fix approved", ExistingPaths: []string{"code.txt"},
	}}
	if e := s.Approve(a); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(a); e == nil || !strings.Contains(e.Error(), "approval already recorded") {
		t.Fatalf("recoveryの重複承認を許可した: %v", e)
	}
	if s.Status()["state"] != "development" {
		t.Fatal(s.Status())
	}
	decide(t, s)
	review(t, s)
	stage(t, s)
	command(t, s.Root, "commit", "-m", "re-ship")
	command(t, s.Root, "push", "origin", "HEAD:main")
	head := command(t, s.Root, "rev-parse", "HEAD")
	bin := t.TempDir()
	put(t, bin, "gh", "#!/bin/sh\nprintf '%s\\n' '{\"headRefOid\":\""+head+"\",\"headRefName\":\"main\",\"baseRefName\":\"target\",\"state\":\"OPEN\"}'\n")
	if e := os.Chmod(filepath.Join(bin, "gh"), 0755); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	if e := s.RecordShip(Ship{Commit: head, Remote: "origin", Branch: "main", PR: "https://example.test/pr/1", Evidence: "verified", Base: "target"}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "shipped" {
		t.Fatal(s.Status())
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

func TestRecoveryIntentProposalAllowsIntentRevision(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "後からIntent改善を提案"}); e != nil {
		t.Fatal(e)
	}
	a := Approval{AuditHash: s.latest("audit").Hash, Source: "user:proposal", Text: "Intent改善を承認", ProposalIDs: []string{"P1"}, Recovery: &Recovery{
		BaselineCommit: command(t, s.Root, "rev-parse", "HEAD"), ExistingSource: "user:scope", ExistingText: "既存変更を確認", ExistingPaths: []string{"code.txt"},
		Proposal: &Proposal{ID: "P1", Finding: "Intent不足", Evidence: "review", Change: "目的を改訂", Paths: []string{"@intent"}},
	}}
	if e := s.Approve(a); e != nil {
		t.Fatal(e)
	}
	d, e := s.decision()
	if e != nil {
		t.Fatal(e)
	}
	intent := s.CurrentIntent()
	intent.Source = "user:revised-intent"
	intent.Objective = "改訂後の成果"
	d.IntentRevision = &intent
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	if e := s.ReturnIntent("改訂したIntentと承認範囲を再確認"); e != nil {
		t.Fatal(e)
	}
	if e := s.Check(); e != nil {
		t.Fatal(e)
	}
}

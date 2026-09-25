package core

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func command(t *testing.T, root string, args ...string) string {
	t.Helper()
	b, e := git(root, args...)
	if e != nil {
		t.Fatal(e)
	}
	return strings.TrimSpace(string(b))
}
func put(t *testing.T, root, path, text string) {
	t.Helper()
	full := filepath.Join(root, path)
	if e := os.MkdirAll(filepath.Dir(full), 0755); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(full, []byte(text), 0644); e != nil {
		t.Fatal(e)
	}
}
func fixture(t *testing.T) *Store {
	t.Helper()
	root := t.TempDir()
	command(t, root, "init", "-b", "main")
	command(t, root, "config", "user.email", "test@example.com")
	command(t, root, "config", "user.name", "test")
	put(t, root, "docs/harness/rule-map.json", `{"version":2,"rules":[],"review_routing":{}}`)
	put(t, root, "code.txt", "before\n")
	command(t, root, "add", ".")
	command(t, root, "commit", "-m", "baseline")
	s, e := StartTask(root, "example", Start{Intent: Intent{Source: "user-message:1", Text: "implement outcome", Objective: "outcome", Acceptance: []string{"works"}}, Authority: "implement and ship", Baseline: command(t, root, "rev-parse", "HEAD")})
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func decide(t *testing.T, s *Store) {
	t.Helper()
	e := s.Decide(Decision{Summary: "implement", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}}})
	if e != nil {
		t.Fatal(e)
	}
}
func review(t *testing.T, s *Store) {
	t.Helper()
	if e := s.Verify(); e != nil {
		t.Fatal(e)
	}
	if e := s.Review(Review{Summary: "checked", Criteria: []Criterion{{"works", "observed outcome", "pass"}}}); e != nil {
		t.Fatal(e)
	}
}
func stage(t *testing.T, s *Store) { command(t, s.Root, "add", ".") }
func TestFreshnessAndModes(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	review(t, s)
	if s.ShipCheck() == nil {
		t.Fatal("unstaged accepted")
	}
	stage(t, s)
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(filepath.Join(s.Root, "code.txt"), 0755); e != nil {
		t.Fatal(e)
	}
	if s.ShipCheck() == nil {
		t.Fatal("mode change accepted")
	}
	os.Chmod(filepath.Join(s.Root, "code.txt"), 0644)
	put(t, s.Root, "code.txt", "changed\n")
	if s.ShipCheck() == nil {
		t.Fatal("stale source accepted")
	}
}
func TestDecisionAndFailedVerification(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	review(t, s)
	decide(t, s)
	stage(t, s)
	if s.ShipCheck() == nil {
		t.Fatal("old revision evidence accepted")
	}
	d, _ := s.decision()
	d.Commands = append(d.Commands, []string{"git", "not-a-command"})
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	if s.Verify() == nil {
		t.Fatal("failed command accepted")
	}
	v := eventData[Verification](s.latest("verify"))
	if len(v.Results) != 2 || v.Results[1].Exit == 0 {
		t.Fatal("failure evidence missing")
	}
}
func TestVerificationSourceMutation(t *testing.T) {
	s := fixture(t)
	d := Decision{Summary: "test", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}, {"sh", "-c", "printf changed > code.txt"}}}
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	if s.Verify() == nil {
		t.Fatal("mutating command accepted")
	}
}
func TestScopeAndRecordIntegrity(t *testing.T) {
	s := fixture(t)
	decide(t, s)
	put(t, s.Root, "other.txt", "foreign")
	if s.Verify() == nil {
		t.Fatal("foreign change hidden")
	}
	os.Remove(filepath.Join(s.Root, "other.txt"))
	put(t, s.Root, ".aidd/v4/example/hidden.txt", "foreign")
	if s.Verify() == nil {
		t.Fatal("nonrecord own file hidden")
	}
	os.Remove(filepath.Join(s.Root, ".aidd/v4/example/hidden.txt"))
	loaded, e := Load(s.Root, s.Task.ID)
	if e != nil || len(loaded.Events) != 2 {
		t.Fatal(e)
	}
	file := filepath.Join(s.dir(), "events/000002.json")
	b, e := os.ReadFile(file)
	if e != nil {
		t.Fatal(e)
	}
	os.WriteFile(file, []byte(strings.Replace(string(b), "implement", "tampered", 1)), 0644)
	if _, e = Load(s.Root, s.Task.ID); e == nil {
		t.Fatal("edited event accepted")
	}
}
func fakeShip(t *testing.T, s *Store) {
	t.Helper()
	review(t, s)
	stage(t, s)
	command(t, s.Root, "commit", "-m", "change")
	remote := t.TempDir()
	command(t, remote, "init", "--bare")
	command(t, s.Root, "remote", "add", "origin", remote)
	command(t, s.Root, "push", "origin", "HEAD:main")
	head := command(t, s.Root, "rev-parse", "HEAD")
	bin := t.TempDir()
	put(t, bin, "gh", "#!/bin/sh\nprintf '%s\\n' '{\"headRefOid\":\""+head+"\",\"headRefName\":\"main\",\"baseRefName\":\"target\",\"state\":\"OPEN\"}'\n")
	os.Chmod(filepath.Join(bin, "gh"), 0755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	if e := s.RecordShip(Ship{Commit: head, Remote: "origin", Branch: "main", PR: "https://example.test/pr/1", Evidence: "remote verified", Base: "target"}); e != nil {
		t.Fatal(e)
	}
}
func TestCycleAndApproval(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	if s.Approve(Approval{}) == nil {
		t.Fatal("premature approval")
	}
	fakeShip(t, s)
	a := Audit{Summary: "session audit", SessionImprovements: []string{"clarify code"}, Proposals: []Proposal{{ID: "p1", Finding: "ambiguity", Evidence: "session observation", Change: "clarify", Paths: []string{"code.txt"}}}}
	if e := s.Audit(a); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	if s.Verify() == nil {
		t.Fatal("work before approval")
	}
	approval := Approval{AuditHash: s.latest("audit").Hash, Source: "user-message:2", Text: "approve p1 clarification", ProposalIDs: []string{"p1"}}
	bad := approval
	bad.Text = s.Task.Authority
	if s.Approve(bad) == nil {
		t.Fatal("development authority reused")
	}
	bad = approval
	bad.AuditHash = "old"
	if s.Approve(bad) == nil {
		t.Fatal("stale audit accepted")
	}
	if e := s.Approve(approval); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "other.txt", "bad")
	if s.ImproveCheck() == nil {
		t.Fatal("unapproved improvement accepted")
	}
	os.Remove(filepath.Join(s.Root, "other.txt"))
	put(t, s.Root, "code.txt", "clarified\n")
	if e := s.ImproveCheck(); e != nil {
		t.Fatal(e)
	}
	decide(t, s)
	fakeShipAgain(t, s)
	if e := s.Audit(Audit{Summary: "improvement verified; no proposals"}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	if s.Verify() == nil {
		t.Fatal("completed cycle resumed without authority")
	}
}
func fakeShipAgain(t *testing.T, s *Store) {
	t.Helper()
	if e := s.ReturnIntent("Intentと改善済みガードレールを再確認"); e != nil {
		t.Fatal(e)
	}
	decide(t, s)
	review(t, s)
	stage(t, s)
	command(t, s.Root, "commit", "-m", "improve")
	command(t, s.Root, "push", "origin", "HEAD:main")
	head := command(t, s.Root, "rev-parse", "HEAD")
	bin := t.TempDir()
	put(t, bin, "gh", "#!/bin/sh\nprintf '%s\\n' '{\"headRefOid\":\""+head+"\",\"headRefName\":\"main\",\"baseRefName\":\"target\",\"state\":\"OPEN\"}'\n")
	os.Chmod(filepath.Join(bin, "gh"), 0755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	if e := s.RecordShip(Ship{head, "origin", "main", "https://example.test/pr/1", "verified", "target"}); e != nil {
		t.Fatal(e)
	}
}
func TestRulesClosureAndFailure(t *testing.T) {
	root := t.TempDir()
	put(t, root, "a.md", "a")
	put(t, root, "b.md", "b")
	put(t, root, "c.md", "c")
	rm := `{"version":2,"rules":[{"id":"a","file":"a.md","applies_to":{"paths":["src/**"]},"depends_on":["b"]},{"id":"b","file":"b.md","applies_to":{"paths":[]}},{"id":"c","file":"c.md","applies_to":{"paths":[]}}],"review_routing":{"governed_paths":["src/**","missing/**"],"surfaces":[{"id":"src","paths":["src/**"],"required_rules":["a"]}]}}`
	put(t, root, "docs/harness/rule-map.json", rm)
	r, e := ResolveRules(root, []string{"src/deep/x.go"})
	if e != nil || len(r) != 2 {
		t.Fatalf("%v %v", r, e)
	}
	if _, e = ResolveRules(root, []string{"missing/file"}); e == nil {
		t.Fatal("unmapped path accepted")
	}
	put(t, root, "docs/harness/rule-map.json", strings.Replace(rm, "src/**", "src/[", 1))
	if _, e = ResolveRules(root, nil); e == nil {
		t.Fatal("malformed glob accepted")
	}
}
func TestStrictJSON(t *testing.T) {
	var x Start
	for _, v := range []string{`{"unknown":1}`, `{} trailing`, `{} {}`} {
		if decode([]byte(v), &x) == nil {
			t.Fatal(v)
		}
	}
	b, _ := json.Marshal(Start{})
	if e := decode(b, &x); e != nil {
		t.Fatal(e)
	}
}
func TestMandatoryChecks(t *testing.T) {
	if (&Store{}).requireCommands([]string{"tools/aidd/checker/x.go"}, Decision{Commands: [][]string{{"true"}}}) == nil {
		t.Fatal("mandatory checks absent")
	}
	if _, e := exec.LookPath("git"); e != nil {
		t.Fatal(e)
	}
}

func TestCandidateEvidenceAndRecordDelivery(t *testing.T) {
	s := fixture(t)
	base := s.Task.Baseline
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	if CheckChanges(s.Root, base) == nil {
		t.Fatal("candidate without evidence accepted")
	}
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "audit complete"}); e != nil {
		t.Fatal(e)
	}
	if e := CheckChanges(s.Root, base); e != nil {
		t.Fatal(e)
	}
	stage(t, s)
	command(t, s.Root, "commit", "-m", "record audit")
	command(t, s.Root, "push", "origin", "HEAD:main")
	head := command(t, s.Root, "rev-parse", "HEAD")
	bin := t.TempDir()
	put(t, bin, "gh", "#!/bin/sh\nprintf '%s\\n' '{\"headRefOid\":\""+head+"\",\"headRefName\":\"main\",\"baseRefName\":\"target\",\"state\":\"OPEN\"}'\n")
	os.Chmod(filepath.Join(bin, "gh"), 0755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	before := len(s.Events)
	if e := s.DeliveryCheck(Ship{head, "origin", "main", "https://example.test/pr/1", "records delivered", "target"}); e != nil {
		t.Fatal(e)
	}
	if len(s.Events) != before {
		t.Fatal("delivery check appended recursive evidence")
	}
	if _, e := CheckAll(s.Root); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "stale")
	if CheckChanges(s.Root, base) == nil {
		t.Fatal("candidate stale accepted")
	}
	if s.DeliveryCheck(Ship{head, "origin", "main", "https://example.test/pr/1", "bad", "target"}) == nil {
		t.Fatal("source change hidden as records")
	}
}
func TestWebVerificationApplicability(t *testing.T) {
	s := fixture(t)
	has := func(paths []string, cmd string) bool {
		for _, c := range s.mandatoryCommands(paths) {
			if strings.Join(c, " ") == cmd {
				return true
			}
		}
		return false
	}
	if has([]string{"apps/web/docs/policy.md"}, "pnpm run web:lint") {
		t.Fatal("docs require app verification")
	}
	put(t, s.Root, "apps/web/src/example.stories.tsx", "export default {};")
	if has([]string{"apps/web/src/example.stories.tsx"}, "pnpm run web:test:storybook") {
		t.Fatal("untagged story needs browser suite")
	}
	put(t, s.Root, "apps/web/src/example.stories.tsx", "tags: ['browser-test']")
	if !has([]string{"apps/web/src/example.stories.tsx"}, "pnpm run web:test:storybook") {
		t.Fatal("tagged story omitted")
	}
}
func TestApprovalBeforeChanges(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "audit", Proposals: []Proposal{{"p", "finding", "evidence", "change", []string{"code.txt"}}}}); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "premature change\n")
	if s.Approve(Approval{s.latest("audit").Hash, "user:2", "approve p", []string{"p"}}) == nil {
		t.Fatal("changes before approval accepted")
	}
}

func TestIntentRevisionAndStaleStatus(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	fakeShip(t, s)
	if e := s.Audit(Audit{Summary: "audit", Proposals: []Proposal{{"intent", "unclear intent", "session", "clarify", []string{"@intent"}}}}); e != nil {
		t.Fatal(e)
	}
	d, _ := s.decision()
	i := s.Task.Intent
	i.Source = "user-message:2"
	i.Acceptance = []string{"works better"}
	d.IntentRevision = &i
	if s.Decide(d) == nil {
		t.Fatal("intent revision before approval")
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user-message:2", "approve intent", []string{"intent"}}); e != nil {
		t.Fatal(e)
	}
	if e := s.Decide(d); e != nil {
		t.Fatal(e)
	}
	if s.Status()["evidence_current"] != false {
		t.Fatal("revised decision retained evidence")
	}
	if e := s.Verify(); e != nil {
		t.Fatal(e)
	}
	if s.Review(Review{Summary: "old review", Criteria: []Criterion{{"works", "evidence", "pass"}}}) == nil {
		t.Fatal("old Intent criteria accepted")
	}
	if e := s.Review(Review{Summary: "new review", Criteria: []Criterion{{"works better", "evidence", "pass"}}}); e != nil {
		t.Fatal(e)
	}
	if s.Task.Intent.Acceptance[0] != "works" {
		t.Fatal("original Intent overwritten")
	}
}
func TestPartialApprovalCarryAndDismissal(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	decide(t, s)
	fakeShip(t, s)
	p1 := Proposal{"p1", "finding1", "evidence", "change", []string{"code.txt"}}
	p2 := Proposal{"p2", "finding2", "evidence", "change", []string{"code.txt"}}
	if e := s.Audit(Audit{Summary: "two proposals", Proposals: []Proposal{p1, p2}}); e != nil {
		t.Fatal(e)
	}
	if e := s.Approve(Approval{s.latest("audit").Hash, "user:2", "approve only p1", []string{"p1"}}); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "improved\n")
	decide(t, s)
	fakeShipAgain(t, s)
	if e := s.Audit(Audit{Summary: "p1 completed"}); e != nil {
		t.Fatal(e)
	}
	a := eventData[Audit](s.latest("audit"))
	if len(a.Proposals) != 1 || a.Proposals[0].ID != "p2" || s.Status()["state"] != "approval-pending" {
		t.Fatal("unapproved proposal lost", a, s.Status())
	}
	if e := s.Dismiss(Approval{s.latest("audit").Hash, "user:3", "decline p2", []string{"p2"}}); e != nil {
		t.Fatal(e)
	}
	if s.Status()["state"] != "approval-pending" {
		t.Fatal(s.Status())
	}
	put(t, s.Root, "code.txt", "unauthorized")
	if s.Status()["state"] == "complete" {
		t.Fatal("changed source reports complete")
	}
}
func TestGlobRejectsMidSegmentDoubleStar(t *testing.T) {
	for _, pattern := range []string{"src/**foo", "src/foo**bar", "src/***"} {
		if _, e := glob(pattern, "src/foo"); e == nil {
			t.Fatal("invalid glob accepted", pattern)
		}
	}
	if ok, e := glob("src/**/*.go", "src/file.go"); e != nil || !ok {
		t.Fatal(ok, e)
	}
}

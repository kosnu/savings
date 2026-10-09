package core

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func plan(commands ...[]string) VerificationPlan {
	return VerificationPlan{Paths: []string{"code.txt"}, Commands: append([][]string{{"git", "diff", "--check"}}, commands...)}
}
func TestStatelessChecksAndNoOutputInResult(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	before, _, e := s.current()
	if e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 3; i++ {
		v, e := s.Verify(plan([]string{"sh", "-c", "printf confidential; printf confidential >&2"}), io.Discard)
		if e != nil || !v.Stable || len(v.Results) != 2 {
			t.Fatalf("%+v %v", v, e)
		}
		b, _ := json.Marshal(v)
		if strings.Contains(string(b), "confidential") || strings.Contains(string(b), "output") || strings.Contains(string(b), "argv") {
			t.Fatalf("output leaked: %s", b)
		}
		if e = CheckChanges(s.Root, s.Base); e != nil {
			t.Fatal(e)
		}
	}
	after, _, e := s.current()
	if e != nil || len(changed(before, after)) != 0 {
		t.Fatalf("checks wrote files: %v", e)
	}
	if _, e = os.Stat(filepath.Join(s.Root, ".aidd")); !os.IsNotExist(e) {
		t.Fatal("Task files created", e)
	}
}
func TestVerificationRejectsFailureMutationAndIncompleteScope(t *testing.T) {
	for _, tc := range []struct {
		name, script string
		stable       bool
		exit         int
	}{
		{"failed", "exit 7", true, 7}, {"mutated", "printf changed > code.txt", false, 0}, {"unstarted", "", true, -1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := fixture(t)
			put(t, s.Root, "code.txt", "after\n")
			args := []string{"sh", "-c", tc.script}
			if tc.name == "unstarted" {
				args = []string{"/nonexistent-aidd-command"}
			}
			v, e := s.Verify(plan(args), io.Discard)
			if e == nil || v.Stable != tc.stable || len(v.Results) != 2 || v.Results[1].Exit != tc.exit {
				t.Fatalf("%+v %v", v, e)
			}
		})
	}
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	p := plan()
	p.Paths = []string{"other.txt"}
	if _, e := s.Verify(p, io.Discard); e == nil {
		t.Fatal("scope ignored")
	}
	p = plan()
	p.Commands = [][]string{{"true"}}
	if _, e := s.Verify(p, io.Discard); e == nil {
		t.Fatal("required checks omitted")
	}
	s.Base = "missing"
	if _, e := s.Verify(plan(), io.Discard); e == nil {
		t.Fatal("missing base accepted")
	}
	for _, base := range []string{"work", "index"} {
		s.Base = base
		if _, e := s.Verify(plan(), io.Discard); e == nil {
			t.Fatal("snapshot selector accepted as a commit baseline", base)
		}
	}
}
func TestShipCheckContentModeAndWhitespace(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, "code.txt", "after\n")
	if s.ShipCheck() == nil {
		t.Fatal("unstaged change accepted")
	}
	command(t, s.Root, "add", ".")
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(filepath.Join(s.Root, "code.txt"), 0755); e != nil {
		t.Fatal(e)
	}
	if s.ShipCheck() == nil {
		t.Fatal("mode change accepted")
	}
	command(t, s.Root, "add", ".")
	if e := s.ShipCheck(); e != nil {
		t.Fatal(e)
	}
	put(t, s.Root, "code.txt", "trailing \n")
	command(t, s.Root, "add", ".")
	if s.ShipCheck() == nil {
		t.Fatal("whitespace error accepted")
	}
}
func TestHistoricalRecordsAreNotExecutionInput(t *testing.T) {
	s := fixture(t)
	put(t, s.Root, ".aidd/v4/history/task.json", "invalid old record")
	if e := CheckChanges(s.Root, s.Base); e != nil {
		t.Fatal(e)
	}
	if e := CheckChanges(s.Root, ""); e == nil {
		t.Fatal("missing base accepted")
	}
	put(t, s.Root, "docs/harness/rule-map.json", "invalid")
	if e := CheckChanges(s.Root, s.Base); e == nil {
		t.Fatal("invalid graph accepted")
	}
}

func TestDeliveryIdentityAndNoWrites(t *testing.T) {
	s := fixture(t)
	remote := t.TempDir()
	command(t, remote, "init", "--bare")
	command(t, s.Root, "remote", "add", "origin", remote)
	command(t, s.Root, "push", "origin", "main")
	head := command(t, s.Root, "rev-parse", "HEAD")
	bin := t.TempDir()
	gh := filepath.Join(bin, "gh")
	put(t, bin, "gh", "#!/bin/sh\nprintf '%s' \"$AIDD_TEST_PR\"\n")
	if e := os.Chmod(gh, 0755); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	ship := Ship{Commit: head, Remote: "origin", Branch: "main", PR: "https://github.com/example/repo/pull/1", Base: "main"}
	respond := func(head, branch, base, state string) {
		t.Setenv("AIDD_TEST_PR", `{"headRefOid":"`+head+`","headRefName":"`+branch+`","baseRefName":"`+base+`","state":"`+state+`"}`)
	}
	respond(head, "main", "main", "OPEN")
	before, _, e := s.current()
	if e != nil {
		t.Fatal(e)
	}
	if e = s.Ship(ship); e != nil {
		t.Fatal(e)
	}
	for _, tc := range []struct{ head, branch, base, state string }{{"wrong", "main", "main", "OPEN"}, {head, "wrong", "main", "OPEN"}, {head, "main", "wrong", "OPEN"}, {head, "main", "main", "CLOSED"}} {
		respond(tc.head, tc.branch, tc.base, tc.state)
		if s.Ship(ship) == nil {
			t.Fatal("PR identity mismatch accepted", tc)
		}
	}
	respond(head, "main", "main", "OPEN")
	wrong := ship
	wrong.Commit = "wrong"
	if s.Ship(wrong) == nil {
		t.Fatal("wrong HEAD accepted")
	}
	wrong = ship
	wrong.Branch = "missing"
	if s.Ship(wrong) == nil {
		t.Fatal("missing remote ref accepted")
	}
	after, _, e := s.current()
	if e != nil || len(changed(before, after)) != 0 {
		t.Fatal("delivery wrote records", e)
	}
}

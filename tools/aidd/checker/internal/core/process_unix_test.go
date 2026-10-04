//go:build darwin || linux

package core

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVerifyRecordsSnapshotFailure(t *testing.T) {
	for _, exit := range []string{"0", "7"} {
		t.Run("exit-"+exit, func(t *testing.T) {
			s := fixture(t)
			put(t, s.Root, "code.txt", "after\n")
			t.Setenv("AIDD_TEST_SNAPSHOT_FAILURE", "0")
			script := `if [ "$AIDD_TEST_SNAPSHOT_FAILURE" = 1 ]; then rm code.txt; mkfifo code.txt; printf snapshot-test; exit ` + exit + `; fi`
			if err := s.Decide(Decision{Summary: "snapshot failure", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}, {"sh", "-c", script}}}); err != nil {
				t.Fatal(err)
			}
			review(t, s)
			stage(t, s)
			if err := s.ShipCheck(); err != nil {
				t.Fatal(err)
			}
			previous := s.latest("verify").Sequence
			t.Setenv("AIDD_TEST_SNAPSHOT_FAILURE", "1")
			if err := s.Verify(); err == nil || !strings.Contains(err.Error(), "unsupported tracked file type") {
				t.Fatalf("snapshot failure not reported: %v", err)
			}
			v := eventData[Verification](s.latest("verify"))
			if s.latest("verify").Sequence <= previous || v.Stable || len(v.Results) != 2 || !strings.Contains(v.Results[1].Output, "snapshot-test") {
				t.Errorf("snapshot failure evidence missing: %+v", v)
			}
			if len(v.Results) == 2 && (exit == "0") != (v.Results[1].Exit == 0) {
				t.Errorf("command exit not retained: %+v", v.Results[1])
			}
			if err := os.Remove(filepath.Join(s.Root, "code.txt")); err != nil {
				t.Fatal(err)
			}
			put(t, s.Root, "code.txt", "after\n")
			var err error
			s, err = Load(s.Root, s.Task.ID)
			if err != nil {
				t.Fatal(err)
			}
			stage(t, s)
			if s.ShipCheck() == nil {
				t.Error("old success accepted after snapshot failure")
			}
			if CheckChanges(s.Root, s.Task.Baseline) == nil {
				t.Error("candidate accepted old success after snapshot failure")
			}
			t.Setenv("AIDD_TEST_SNAPSHOT_FAILURE", "0")
			review(t, s)
			stage(t, s)
			if err := s.ShipCheck(); err != nil {
				t.Fatal(err)
			}
			if err := CheckChanges(s.Root, s.Task.Baseline); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestVerificationProcessCleanup(t *testing.T) {
	for _, script := range []string{"sleep 30 &", "sleep 30 >/dev/null 2>&1 &"} {
		t.Run(script, func(t *testing.T) {
			start := time.Now()
			_, err := runVerification(exec.Command("sh", "-c", script))
			if err == nil || !strings.Contains(err.Error(), "residual processes") {
				t.Fatalf("residual process accepted: %v", err)
			}
			if time.Since(start) > 5*time.Second {
				t.Fatal("wait was not bounded")
			}
		})
	}
	output, err := runVerification(exec.Command("sh", "-c", "printf ok; sleep 0.1"))
	if err != nil || string(output) != "ok" {
		t.Fatalf("normal command failed: %q %v", output, err)
	}
	if _, err = runVerification(exec.Command("sh", "-c", "exit 7")); err == nil {
		t.Fatal("failed command accepted")
	}
	if _, err = runVerification(exec.Command("/nonexistent-aidd-command")); err == nil {
		t.Fatal("start failure accepted")
	}
}

func TestVerifyRecordsResidualProcessFailure(t *testing.T) {
	s := fixture(t)
	if err := s.Decide(Decision{Summary: "residual child", Paths: []string{"code.txt"}, Commands: [][]string{{"git", "diff", "--check"}, {"sh", "-c", "sleep 30 &"}}}); err != nil {
		t.Fatal(err)
	}
	if s.Verify() == nil {
		t.Fatal("residual child accepted")
	}
	v := eventData[Verification](s.latest("verify"))
	if len(v.Results) != 2 || v.Results[1].Exit == 0 || !strings.Contains(v.Results[1].Output, "residual processes") {
		t.Fatalf("failure not recorded: %+v", v)
	}
	if s.Review(Review{Summary: "checked", Criteria: []Criterion{{"works", "observed", "pass"}}}) == nil {
		t.Fatal("failed verification accepted by review")
	}
}

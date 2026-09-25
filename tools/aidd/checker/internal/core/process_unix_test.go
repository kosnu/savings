//go:build darwin || linux

package core

import (
	"os/exec"
	"strings"
	"testing"
	"time"
)

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

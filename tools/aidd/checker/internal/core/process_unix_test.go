//go:build darwin || linux

package core

import (
	"bytes"
	"io"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestVerifySnapshotFailure(t *testing.T) {
	for _, exit := range []string{"0", "7"} {
		t.Run(exit, func(t *testing.T) {
			s := fixture(t)
			put(t, s.Root, "code.txt", "after\n")
			v, e := s.Verify(plan([]string{"sh", "-c", "rm code.txt; mkfifo code.txt; exit " + exit}), io.Discard)
			if e == nil || !strings.Contains(e.Error(), "unsupported tracked file type") || v.Stable || len(v.Results) != 2 {
				t.Fatalf("%+v %v", v, e)
			}
		})
	}
}
func TestVerificationProcessCleanup(t *testing.T) {
	for _, script := range []string{"sleep 30 &", "sleep 30 >/dev/null 2>&1 &"} {
		start := time.Now()
		c := exec.Command("sh", "-c", script)
		c.Stdout = io.Discard
		c.Stderr = io.Discard
		if e := runVerification(c); e == nil || !strings.Contains(e.Error(), "residual processes") {
			t.Fatalf("residual command accepted: %v", e)
		}
		if time.Since(start) > 5*time.Second {
			t.Fatal("wait unbounded")
		}
	}
	var output bytes.Buffer
	c := exec.Command("sh", "-c", "printf ok; sleep 0.1")
	c.Stdout = &output
	if e := runVerification(c); e != nil || output.String() != "ok" {
		t.Fatalf("%s %v", output.String(), e)
	}
	s := fixture(t)
	v, e := s.Verify(plan([]string{"sh", "-c", "sleep 30 >/dev/null 2>&1 &"}), io.Discard)
	if e == nil || v.Results[1].Exit == 0 {
		t.Fatalf("residual processes marked successful: %+v %v", v, e)
	}
}

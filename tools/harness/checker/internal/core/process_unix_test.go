//go:build darwin || linux

package core

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
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
		if e := runProcessGroup(c, "verification"); e == nil || !strings.Contains(e.Error(), "residual processes") {
			t.Fatalf("residual command accepted: %v", e)
		}
		if time.Since(start) > 5*time.Second {
			t.Fatal("wait unbounded")
		}
	}
	var output bytes.Buffer
	c := exec.Command("sh", "-c", "printf ok; sleep 0.1")
	c.Stdout = &output
	if e := runProcessGroup(c, "verification"); e != nil || output.String() != "ok" {
		t.Fatalf("%s %v", output.String(), e)
	}
	s := fixture(t)
	v, e := s.Verify(plan([]string{"sh", "-c", "sleep 30 >/dev/null 2>&1 &"}), io.Discard)
	if e == nil || v.Results[1].Exit == 0 {
		t.Fatalf("residual processes marked successful: %+v %v", v, e)
	}
}

func TestDeliveryLookupTimeout(t *testing.T) {
	for _, target := range []string{"remote SHA", "PR"} {
		t.Run(target, func(t *testing.T) {
			s := fixture(t)
			head := command(t, s.Root, "rev-parse", "HEAD")
			bin := t.TempDir()
			childPipe := filepath.Join(bin, "child.pipe")
			if err := syscall.Mkfifo(childPipe, 0600); err != nil {
				t.Fatal(err)
			}
			reader, err := syscall.Open(childPipe, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_CLOEXEC, 0)
			if err != nil {
				t.Fatal(err)
			}
			defer syscall.Close(reader)
			t.Setenv("HARNESS_TEST_CHILD_PIPE", childPipe)
			t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))

			blocker := filepath.Join(bin, "gh")
			// 子の開始を通知し、その子が終了したらテスト側で EOF を観測できるようにする。
			put(t, bin, "gh", "#!/bin/sh\n(printf x; exec sleep 10) > \"$HARNESS_TEST_CHILD_PIPE\" 2>/dev/null &\nwait\n")
			if err := os.Chmod(blocker, 0755); err != nil {
				t.Fatal(err)
			}
			if target == "remote SHA" {
				t.Setenv("GIT_SSH_COMMAND", `sh "${HARNESS_TEST_BLOCKER}"`)
				t.Setenv("GIT_SSH_VARIANT", "ssh")
				t.Setenv("HARNESS_TEST_BLOCKER", blocker)
				command(t, s.Root, "remote", "add", "origin", "ssh://example.invalid/repo")
			} else {
				// 同じ ref を持つローカルリポジトリで SHA 照合を通す。
				command(t, s.Root, "remote", "add", "origin", s.Root)
			}

			ship := Ship{Commit: head, Remote: "origin", Branch: "main", PR: "https://github.com/example/repo/pull/1", Base: "main"}
			start := time.Now()
			err = s.ship(ship, time.Second)
			if !errors.Is(err, context.DeadlineExceeded) || !strings.Contains(err.Error(), "ship verification incomplete: "+target+" lookup timed out") {
				t.Fatalf("expected incomplete %s lookup, got %v", target, err)
			}
			if elapsed := time.Since(start); elapsed > 5*time.Second {
				t.Fatalf("lookup took %s after a 1s deadline", elapsed)
			}
			assertLookupChildStopped(t, reader)
		})
	}
}

func assertLookupChildStopped(t *testing.T, reader int) {
	t.Helper()
	var marker [2]byte
	if count, err := syscall.Read(reader, marker[:]); err != nil || count != 1 || marker[0] != 'x' {
		t.Fatalf("expected one child start, got %d bytes (%v)", count, err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		count, err := syscall.Read(reader, marker[:])
		if count == 0 && err == nil {
			return
		}
		if err != syscall.EAGAIN && err != syscall.EINTR {
			t.Fatalf("expected EOF after child exit, got %d bytes (%v)", count, err)
		}
		if time.Now().After(deadline) {
			t.Fatal("lookup child still holds the pipe open")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

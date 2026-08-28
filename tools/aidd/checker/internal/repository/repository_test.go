package repository

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func TestSnapshotRejectsSymlinksInEveryAccessPath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := newGitRepository(t)
	writeRepositoryFile(t, root, "real/input.txt", []byte("trusted\n"), 0o644)
	if err := os.Symlink("real", filepath.Join(root, "linked")); err != nil {
		t.Fatal(err)
	}

	snapshot := openSnapshot(t, root)
	if _, err := snapshot.Read("linked/input.txt"); diagnosticCode(err) != "AIDD_PATH_SYMLINK" {
		t.Fatalf("Read() error code = %q, want AIDD_PATH_SYMLINK: %v", diagnosticCode(err), err)
	}
	if _, err := snapshot.Exists("linked/input.txt"); diagnosticCode(err) != "AIDD_PATH_SYMLINK" {
		t.Fatalf("Exists() error code = %q, want AIDD_PATH_SYMLINK: %v", diagnosticCode(err), err)
	}
	if _, err := snapshot.ResolveDirectory("linked"); diagnosticCode(err) != "AIDD_PATH_SYMLINK" {
		t.Fatalf("ResolveDirectory() error code = %q, want AIDD_PATH_SYMLINK: %v", diagnosticCode(err), err)
	}
	if err := snapshot.WriteAtomic("linked/output.txt", []byte("unsafe\n")); diagnosticCode(err) != "AIDD_PATH_SYMLINK" {
		t.Fatalf("WriteAtomic() error code = %q, want AIDD_PATH_SYMLINK: %v", diagnosticCode(err), err)
	}
}

func TestReadDirRejectsSymlinkChild(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := newGitRepository(t)
	writeRepositoryFile(t, root, "workspaces/real/file.txt", []byte("trusted\n"), 0o644)
	if err := os.Symlink("real", filepath.Join(root, "workspaces", "linked")); err != nil {
		t.Fatal(err)
	}

	snapshot := openSnapshot(t, root)
	if _, err := snapshot.ReadDir("workspaces"); diagnosticCode(err) != "AIDD_PATH_SYMLINK" {
		t.Fatalf("ReadDir() error code = %q, want AIDD_PATH_SYMLINK: %v", diagnosticCode(err), err)
	}
}

func TestSnapshotDetectsContentModeAndTypeDrift(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(t *testing.T, path string)
	}{
		{
			name: "content",
			mutate: func(t *testing.T, path string) {
				t.Helper()
				if err := os.WriteFile(path, []byte("changed\n"), 0o644); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "mode",
			mutate: func(t *testing.T, path string) {
				t.Helper()
				if err := os.Chmod(path, 0o600); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "type",
			mutate: func(t *testing.T, path string) {
				t.Helper()
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
				if err := os.Mkdir(path, 0o755); err != nil {
					t.Fatal(err)
				}
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			root := newGitRepository(t)
			path := writeRepositoryFile(t, root, "input.txt", []byte("trusted\n"), 0o644)
			snapshot := openSnapshot(t, root)
			if _, err := snapshot.Read("input.txt"); err != nil {
				t.Fatal(err)
			}
			test.mutate(t, path)
			if err := snapshot.AssertUnchanged(); diagnosticCode(err) != "AIDD_SNAPSHOT_DRIFT" {
				t.Fatalf("AssertUnchanged() error code = %q, want AIDD_SNAPSHOT_DRIFT: %v", diagnosticCode(err), err)
			}
		})
	}
}

func TestWriteAtomicCreatesConfinedFile(t *testing.T) {
	root := newGitRepository(t)
	snapshot := openSnapshot(t, root)
	if err := snapshot.WriteAtomic("nested/output.txt", []byte("complete\n")); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(root, "nested", "output.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "complete\n" {
		t.Fatalf("output = %q", content)
	}
}

func TestValidateRelativePathRejectsTraversal(t *testing.T) {
	for _, path := range []string{"../outside", "inside/../../outside", "/absolute", ".git/config"} {
		t.Run(path, func(t *testing.T) {
			if _, err := ValidateRelativePath(path); err == nil {
				t.Fatalf("ValidateRelativePath(%q) succeeded", path)
			}
		})
	}
}

func newGitRepository(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	command := exec.Command("git", "init", "--quiet", root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}
	return root
}

func openSnapshot(t *testing.T, root string) *Snapshot {
	t.Helper()
	snapshot, err := Open(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := snapshot.Close(); err != nil {
			t.Errorf("Close(): %v", err)
		}
	})
	return snapshot
}

func writeRepositoryFile(t *testing.T, root, relative string, content []byte, mode os.FileMode) string {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, mode); err != nil {
		t.Fatal(err)
	}
	return path
}

func diagnosticCode(err error) string {
	var value *diagnostic.Diagnostic
	if errors.As(err, &value) {
		return value.Code
	}
	return ""
}

package repository

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func TestCanonicalGitEnvironmentRejectsInheritedRepositorySelection(t *testing.T) {
	environment := CanonicalGitEnvironment(
		[]string{
			"PATH=/bin",
			"GIT_INDEX_FILE=/tmp/alternate-index",
			"git_dir=/tmp/alternate-repository",
			"GIT_CONFIG_COUNT=1",
			"GITHUB_ACTIONS=true",
		},
		[]string{"GIT_INDEX_FILE=/canonical/index"},
	)
	want := map[string]bool{
		"PATH=/bin":                       true,
		"GITHUB_ACTIONS=true":             true,
		"GIT_CONFIG_NOSYSTEM=1":           true,
		"GIT_CONFIG_GLOBAL=" + os.DevNull: true,
		"GIT_INDEX_FILE=/canonical/index": true,
	}
	if len(environment) != len(want) {
		t.Fatalf("canonical Git environment = %#v", environment)
	}
	for _, entry := range environment {
		if !want[entry] {
			t.Fatalf("canonical Git environment retained unexpected entry %q: %#v", entry, environment)
		}
	}
}

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

func TestReadExternalRejectsSymlink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	directory := t.TempDir()
	target := filepath.Join(directory, "target.json")
	if err := os.WriteFile(target, []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(directory, "input.json")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadExternal(link); diagnosticCode(err) != "AIDD_EXTERNAL_TYPE" {
		t.Fatalf("ReadExternal() error code = %q, want AIDD_EXTERNAL_TYPE: %v", diagnosticCode(err), err)
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
	if err := snapshot.AssertCanonicalOutputMode("nested/output.txt", "fixture"); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filepath.Join(root, "nested", "output.txt"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := snapshot.AssertCanonicalOutputMode("nested/output.txt", "fixture"); diagnosticCode(err) != "AIDD_OUTPUT_MODE_DRIFT" {
		t.Fatalf("AssertCanonicalOutputMode() error code = %q, want AIDD_OUTPUT_MODE_DRIFT: %v", diagnosticCode(err), err)
	}
}

func TestReadHeadBlobAcceptsExecutableRegularFile(t *testing.T) {
	root := newGitRepository(t)
	content := []byte("#!/bin/sh\nexit 0\n")
	writeRepositoryFile(t, root, "tools/check", content, 0o755)
	commitRepositoryFixture(t, root)

	snapshot := openSnapshot(t, root)
	actual, exists, err := snapshot.ReadHeadBlob(context.Background(), "tools/check")
	if err != nil {
		t.Fatal(err)
	}
	if !exists || string(actual) != string(content) {
		t.Fatalf("ReadHeadBlob() = (%q, %t), want (%q, true)", actual, exists, content)
	}
}

func TestSnapshotRejectsGitHeadDriftAfterBaselineRead(t *testing.T) {
	root := newGitRepository(t)
	writeRepositoryFile(t, root, "requirements.json", []byte("baseline\n"), 0o644)
	commitRepositoryFixture(t, root)

	snapshot := openSnapshot(t, root)
	if _, _, err := snapshot.ReadHeadBlob(context.Background(), "requirements.json"); err != nil {
		t.Fatal(err)
	}
	runRepositoryGit(t, root, "-c", "user.name=AIDD Test", "-c", "user.email=aidd@example.com", "commit", "--allow-empty", "-qm", "concurrent head advance")
	if err := snapshot.AssertGitHeadUnchanged(context.Background()); diagnosticCode(err) != "AIDD_GIT_HEAD_DRIFT" {
		t.Fatalf("AssertGitHeadUnchanged() error code = %q, want AIDD_GIT_HEAD_DRIFT: %v", diagnosticCode(err), err)
	}
}

func TestReadHeadBlobRejectsSymlinkEntry(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := newGitRepository(t)
	path := filepath.Join(root, "requirements.json")
	if err := os.Symlink("outside.json", path); err != nil {
		t.Fatal(err)
	}
	commitRepositoryFixture(t, root)

	snapshot := openSnapshot(t, root)
	if _, _, err := snapshot.ReadHeadBlob(context.Background(), "requirements.json"); diagnosticCode(err) != "AIDD_GIT_HEAD_TYPE" {
		t.Fatalf("ReadHeadBlob() error code = %q, want AIDD_GIT_HEAD_TYPE: %v", diagnosticCode(err), err)
	}
}

func TestReadHeadBlobRejectsOversizeBeforeContentRead(t *testing.T) {
	root := newGitRepository(t)
	writeRepositoryFile(t, root, "requirements.json", []byte("oversized"), 0o644)
	commitRepositoryFixture(t, root)

	snapshot := openSnapshot(t, root)
	if _, _, err := snapshot.readHeadBlob(context.Background(), "requirements.json", 4); diagnosticCode(err) != "AIDD_GIT_HEAD_SIZE" {
		t.Fatalf("readHeadBlob() error code = %q, want AIDD_GIT_HEAD_SIZE: %v", diagnosticCode(err), err)
	}
}

func TestMutationManifestDetectsSameSizeRewriteWithRestoredMtime(t *testing.T) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		t.Skip("change-time identity is supported on Darwin and Linux")
	}
	root := newGitRepository(t)
	path := writeRepositoryFile(t, root, "ignored/cache.txt", []byte("before\n"), 0o644)
	fixedTime := time.Unix(1_700_000_000, 0)
	if err := os.Chtimes(path, fixedTime, fixedTime); err != nil {
		t.Fatal(err)
	}
	snapshot := openSnapshot(t, root)
	before, err := snapshot.MutationManifest()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("after!\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, fixedTime, fixedTime); err != nil {
		t.Fatal(err)
	}
	after, err := snapshot.MutationManifest()
	if err != nil {
		t.Fatal(err)
	}
	if difference := CompareMutationManifests(before, after); difference == nil || difference.Path != "ignored/cache.txt" {
		t.Fatalf("same-size restored-mtime rewrite was not identified: %#v", difference)
	}
}

func TestMutationManifestDetectsTransientDirectoryMutation(t *testing.T) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		t.Skip("change-time identity is supported on Darwin and Linux")
	}
	root := newGitRepository(t)
	if err := os.Mkdir(filepath.Join(root, "ignored"), 0o755); err != nil {
		t.Fatal(err)
	}
	snapshot := openSnapshot(t, root)
	before, err := snapshot.MutationManifest()
	if err != nil {
		t.Fatal(err)
	}
	temporary := filepath.Join(root, "ignored", "transient.txt")
	if err := os.WriteFile(temporary, []byte("transient\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(temporary); err != nil {
		t.Fatal(err)
	}
	after, err := snapshot.MutationManifest()
	if err != nil {
		t.Fatal(err)
	}
	if difference := CompareMutationManifests(before, after); difference == nil || difference.Path != "ignored" {
		t.Fatalf("transient directory mutation was not identified: %#v", difference)
	}
}

func TestMutationManifestRecordsSymlinkWithoutFollowingIt(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := newGitRepository(t)
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err := os.WriteFile(outside, []byte("outside\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "outside-link")); err != nil {
		t.Fatal(err)
	}
	snapshot := openSnapshot(t, root)
	manifest, err := snapshot.MutationManifest()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, entry := range manifest.Entries {
		if entry.Path == "outside-link" {
			found = entry.Type == "symlink"
		}
	}
	if !found {
		t.Fatalf("symlink identity missing from manifest: %#v", manifest.Entries)
	}
}

func BenchmarkMutationManifest(b *testing.B) {
	repoRoot := os.Getenv("AIDD_BENCH_REPO_ROOT")
	if repoRoot == "" {
		b.Skip("set AIDD_BENCH_REPO_ROOT to benchmark a real worktree")
	}
	snapshot, err := Open(context.Background(), repoRoot)
	if err != nil {
		b.Fatal(err)
	}
	defer snapshot.Close()
	b.ReportAllocs()
	b.ResetTimer()
	for index := 0; index < b.N; index++ {
		manifest, manifestErr := snapshot.MutationManifest()
		if manifestErr != nil {
			b.Fatal(manifestErr)
		}
		b.ReportMetric(float64(len(manifest.Entries)), "entries")
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

func runRepositoryGit(t *testing.T, root string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

func commitRepositoryFixture(t *testing.T, root string) {
	t.Helper()
	runRepositoryGit(t, root, "add", ".")
	runRepositoryGit(t, root, "-c", "user.name=AIDD Test", "-c", "user.email=aidd@example.com", "commit", "-qm", "fixture")
}

func diagnosticCode(err error) string {
	var value *diagnostic.Diagnostic
	if errors.As(err, &value) {
		return value.Code
	}
	return ""
}

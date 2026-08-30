package state

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestFinalHashStaysStableAcrossStagingWhileRepositoryGitStateChanges(t *testing.T) {
	repoRoot := t.TempDir()
	runStateGit(t, repoRoot, "init", "--quiet")
	runStateGit(t, repoRoot, "config", "user.name", "AIDD Test")
	runStateGit(t, repoRoot, "config", "user.email", "aidd@example.com")
	runStateGit(t, repoRoot, "commit", "--allow-empty", "-qm", "initial")
	if err := os.WriteFile(filepath.Join(repoRoot, "owned.txt"), []byte("content\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := snapshot.Close(); err != nil {
			t.Errorf("Close(): %v", err)
		}
	})
	target := &model.TargetState{
		OwnershipScopes: []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
		Representations: []model.Representation{{ID: "REP-1", Path: "owned.txt"}},
	}
	finalBefore, err := FinalHash(snapshot, target)
	if err != nil {
		t.Fatal(err)
	}
	gitStateBefore, err := RepositoryGitStateHash(context.Background(), snapshot)
	if err != nil {
		t.Fatal(err)
	}
	runStateGit(t, repoRoot, "add", "--", "owned.txt")
	finalAfter, err := FinalHash(snapshot, target)
	if err != nil {
		t.Fatal(err)
	}
	gitStateAfter, err := RepositoryGitStateHash(context.Background(), snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if finalAfter != finalBefore {
		t.Fatalf("final hash changed across staging: before=%s after=%s", finalBefore, finalAfter)
	}
	if gitStateAfter == gitStateBefore {
		t.Fatalf("repository Git state did not change across staging: %s", gitStateAfter)
	}
}

func TestUntrackedInventoryCapturesNonIgnoredIdentityAndSymlinkTarget(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	repoRoot := t.TempDir()
	runStateGit(t, repoRoot, "init", "--quiet")
	if err := os.WriteFile(filepath.Join(repoRoot, ".gitignore"), []byte("ignored/\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(repoRoot, "ignored"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repoRoot, "ignored", "cache.txt"), []byte("ignored\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repoRoot, "既存.txt"), []byte("content\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("既存.txt", filepath.Join(repoRoot, "link")); err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	entries, err := UntrackedInventory(context.Background(), snapshot, nil)
	if err != nil {
		t.Fatal(err)
	}
	byPath := map[string]model.UntrackedEntry{}
	for _, entry := range entries {
		byPath[entry.Path] = entry
	}
	if _, exists := byPath["ignored/cache.txt"]; exists {
		t.Fatalf("ignored entry leaked into baseline: %#v", entries)
	}
	if byPath["既存.txt"].Type != "regular" || byPath["既存.txt"].Mode != "0600" || byPath["既存.txt"].SHA256 == "" {
		t.Fatalf("regular identity is incomplete: %#v", byPath["既存.txt"])
	}
	if byPath["link"].Type != "symlink" || byPath["link"].SHA256 == "" {
		t.Fatalf("symlink identity is incomplete: %#v", byPath["link"])
	}
	if err := ValidateUntrackedBaseline(entries); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(repoRoot, "link")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("missing", filepath.Join(repoRoot, "link")); err != nil {
		t.Fatal(err)
	}
	if err := snapshot.AssertUnchanged(); err == nil || !strings.Contains(err.Error(), "AIDD_SNAPSHOT_DRIFT") {
		t.Fatalf("symlink target drift was not rejected: %v", err)
	}
}

func TestValidateUntrackedBaselineRejectsDuplicateAndMalformedEntries(t *testing.T) {
	valid := model.UntrackedEntry{Path: "path.txt", Type: "regular", Mode: "0644", SHA256: strings.Repeat("a", 64)}
	for name, entries := range map[string][]model.UntrackedEntry{
		"duplicate": {valid, valid},
		"type":      {{Path: "path.txt", Type: "directory", Mode: "0644", SHA256: strings.Repeat("a", 64)}},
		"mode":      {{Path: "path.txt", Type: "regular", Mode: "644", SHA256: strings.Repeat("a", 64)}},
		"hash":      {{Path: "path.txt", Type: "regular", Mode: "0644", SHA256: "invalid"}},
	} {
		t.Run(name, func(t *testing.T) {
			if err := ValidateUntrackedBaseline(entries); err == nil {
				t.Fatalf("malformed baseline accepted: %#v", entries)
			}
		})
	}
}

func runStateGit(t *testing.T, repoRoot string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
}

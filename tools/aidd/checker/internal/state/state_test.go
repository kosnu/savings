package state

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestFinalHashStaysStableAcrossStagingWhileGitIndexHashChanges(t *testing.T) {
	repoRoot := t.TempDir()
	runStateGit(t, repoRoot, "init", "--quiet")
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
	indexBefore, err := GitIndexHash(context.Background(), snapshot, target)
	if err != nil {
		t.Fatal(err)
	}
	runStateGit(t, repoRoot, "add", "--", "owned.txt")
	finalAfter, err := FinalHash(snapshot, target)
	if err != nil {
		t.Fatal(err)
	}
	indexAfter, err := GitIndexHash(context.Background(), snapshot, target)
	if err != nil {
		t.Fatal(err)
	}
	if finalAfter != finalBefore {
		t.Fatalf("final hash changed across staging: before=%s after=%s", finalBefore, finalAfter)
	}
	if indexAfter == indexBefore {
		t.Fatalf("Git index hash did not change across staging: %s", indexAfter)
	}
}

func runStateGit(t *testing.T, repoRoot string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
}

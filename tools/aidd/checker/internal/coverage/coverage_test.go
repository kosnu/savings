package coverage

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

func TestValidatePinnedInputsRejectsNonCanonicalArtifactPath(t *testing.T) {
	loaded := &receipt.Loaded{Value: model.Receipt{
		Workspace: "1671-checker",
		Artifacts: model.ReceiptArtifacts{
			Requirements: model.ArtifactPair{Source: model.ArtifactIdentity{Path: "outside.json"}},
		},
	}}
	err := validatePinnedInputs(&repository.Snapshot{}, loaded, &rules.Loaded{})
	if err == nil || !strings.Contains(err.Error(), "AIDD_ARTIFACT_PATH") {
		t.Fatalf("expected canonical artifact path rejection, got %v", err)
	}
}

func TestGeneratedArtifactPathsRejectInvalidWorkspace(t *testing.T) {
	verificationPath, coveragePath, receiptPath, err := generatedArtifactPaths("../outside")
	if err == nil {
		t.Fatal("expected invalid workspace rejection")
	}
	if verificationPath != "" || coveragePath != "" || receiptPath != "" {
		t.Fatalf("generated paths leaked after error: %q %q %q", verificationPath, coveragePath, receiptPath)
	}
}

func TestChangedPathsRejectsBaselineMismatch(t *testing.T) {
	repoRoot := t.TempDir()
	runCoverageGit(t, repoRoot, "init", "-q")
	runCoverageGit(t, repoRoot, "config", "user.name", "AIDD Test")
	runCoverageGit(t, repoRoot, "config", "user.email", "aidd@example.com")
	if err := os.WriteFile(filepath.Join(repoRoot, "file.txt"), []byte("current\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "file.txt")
	runCoverageGit(t, repoRoot, "commit", "-qm", "current")
	tree := strings.TrimSpace(runCoverageGitOutput(t, repoRoot, "write-tree"))
	command := exec.Command("git", "-C", repoRoot, "commit-tree", tree)
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=AIDD Test", "GIT_AUTHOR_EMAIL=aidd@example.com", "GIT_AUTHOR_DATE=2026-08-28T00:00:00Z",
		"GIT_COMMITTER_NAME=AIDD Test", "GIT_COMMITTER_EMAIL=aidd@example.com", "GIT_COMMITTER_DATE=2026-08-28T00:00:00Z",
	)
	command.Stdin = strings.NewReader("unrelated baseline\n")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git commit-tree failed: %v\n%s", err, output)
	}
	baseline := strings.TrimSpace(string(output))
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	_, err = changedPaths(context.Background(), snapshot, baseline, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_HEAD_DRIFT") {
		t.Fatalf("expected baseline mismatch rejection, got %v", err)
	}
}

func TestChangedPathsRejectsHeadAdvanceBeforeShip(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	path := filepath.Join(repoRoot, "tracked.txt")
	if err := os.WriteFile(path, []byte("after\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "tracked.txt")
	runCoverageGit(t, repoRoot, "commit", "-qm", "premature Build commit")
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	_, err = changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_HEAD_DRIFT") {
		t.Fatalf("expected pre-Ship HEAD drift rejection, got %v", err)
	}
}

func TestChangedPathsRejectsStagingDuringBuild(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	path := filepath.Join(repoRoot, "tracked.txt")
	if err := os.WriteFile(path, []byte("staged\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "tracked.txt")
	if err := os.WriteFile(path, []byte("validated worktree\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	_, err = changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_STAGED_STATE") {
		t.Fatalf("expected staged Build rejection, got %v", err)
	}
}

func TestChangedPathsRejectsIndexOnlyModeChange(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	runCoverageGit(t, repoRoot, "update-index", "--chmod=+x", "tracked.txt")
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	_, err = changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_STAGED_STATE") {
		t.Fatalf("expected staged mode rejection, got %v", err)
	}
}

func TestChangedPathsDetectsModeChangeWhenCoreFileModeIsDisabled(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	runCoverageGit(t, repoRoot, "config", "core.fileMode", "false")
	if err := os.Chmod(filepath.Join(repoRoot, "tracked.txt"), 0o755); err != nil {
		t.Fatal(err)
	}
	if output := runCoverageGitOutput(t, repoRoot, "diff", "--name-status", "--"); output != "" {
		t.Fatalf("fixture mode change was not hidden by core.fileMode=false: %q", output)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	changes, err := changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 1 || changes[0] != (change{Path: "tracked.txt", Status: "M"}) {
		t.Fatalf("hidden mode change classification = %#v", changes)
	}
}

func TestChangedPathsRejectsTrackedPathLeftUntrackedInWorktree(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	runCoverageGit(t, repoRoot, "rm", "--cached", "tracked.txt")
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	_, err = changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_STAGED_STATE") {
		t.Fatalf("expected staged tracked transition rejection, got %v", err)
	}
}

func TestChangedPathsUsesDesignUntrackedBaseline(t *testing.T) {
	tests := []struct {
		name       string
		mutate     func(t *testing.T, repoRoot, path string)
		wantStatus string
	}{
		{name: "unchanged", mutate: func(*testing.T, string, string) {}, wantStatus: ""},
		{name: "modified", mutate: func(t *testing.T, repoRoot, path string) {
			if err := os.WriteFile(filepath.Join(repoRoot, filepath.FromSlash(path)), []byte("after\n"), 0o644); err != nil {
				t.Fatal(err)
			}
		}, wantStatus: "M"},
		{name: "deleted", mutate: func(t *testing.T, repoRoot, path string) {
			if err := os.Remove(filepath.Join(repoRoot, filepath.FromSlash(path))); err != nil {
				t.Fatal(err)
			}
		}, wantStatus: "D"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repoRoot, baselineHead := coverageFixtureRepository(t)
			path := "outside/既存.txt"
			if err := os.MkdirAll(filepath.Join(repoRoot, "outside"), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(repoRoot, filepath.FromSlash(path)), []byte("before\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			baselineSnapshot, err := repository.Open(context.Background(), repoRoot)
			if err != nil {
				t.Fatal(err)
			}
			untrackedBaseline, err := state.UntrackedInventory(context.Background(), baselineSnapshot, nil)
			if err != nil {
				t.Fatal(err)
			}
			if err := baselineSnapshot.Close(); err != nil {
				t.Fatal(err)
			}

			test.mutate(t, repoRoot, path)
			currentSnapshot, err := repository.Open(context.Background(), repoRoot)
			if err != nil {
				t.Fatal(err)
			}
			defer currentSnapshot.Close()
			changes, err := changedPaths(context.Background(), currentSnapshot, baselineHead, untrackedBaseline)
			if err != nil {
				t.Fatal(err)
			}
			matching := []change{}
			for _, item := range changes {
				if item.Path == path {
					matching = append(matching, item)
				}
			}
			if test.wantStatus == "" {
				if len(matching) != 0 {
					t.Fatalf("unchanged baseline untracked path was classified: %#v", matching)
				}
				return
			}
			if len(matching) != 1 || matching[0].Status != test.wantStatus {
				t.Fatalf("change classification = %#v, want one %s", matching, test.wantStatus)
			}
		})
	}
}

func TestChangedPathsClassifiesNewUntrackedPath(t *testing.T) {
	repoRoot, baselineHead := coverageFixtureRepository(t)
	path := "outside/new.txt"
	if err := os.MkdirAll(filepath.Join(repoRoot, "outside"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repoRoot, filepath.FromSlash(path)), []byte("new\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	changes, err := changedPaths(context.Background(), snapshot, baselineHead, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 1 || changes[0] != (change{Path: path, Status: "A"}) {
		t.Fatalf("new untracked classification = %#v", changes)
	}
}

func coverageFixtureRepository(t *testing.T) (string, string) {
	t.Helper()
	repoRoot := t.TempDir()
	runCoverageGit(t, repoRoot, "init", "-q")
	runCoverageGit(t, repoRoot, "config", "user.name", "AIDD Test")
	runCoverageGit(t, repoRoot, "config", "user.email", "aidd@example.com")
	if err := os.WriteFile(filepath.Join(repoRoot, "tracked.txt"), []byte("baseline\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "tracked.txt")
	runCoverageGit(t, repoRoot, "commit", "-qm", "baseline")
	return repoRoot, strings.TrimSpace(runCoverageGitOutput(t, repoRoot, "rev-parse", "HEAD"))
}

func runCoverageGit(t *testing.T, repoRoot string, arguments ...string) {
	t.Helper()
	_ = runCoverageGitOutput(t, repoRoot, arguments...)
}

func runCoverageGitOutput(t *testing.T, repoRoot string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

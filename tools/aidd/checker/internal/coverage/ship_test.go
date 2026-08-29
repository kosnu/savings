package coverage

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

func TestValidateStagedCandidateAcceptsVerifiedWorktreeAndCanonicalOutput(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "tracked.txt", "verified\n")
	writeShipFixture(t, repoRoot, "generated.json", "{}\n")
	runCoverageGit(t, repoRoot, "add", "--", "tracked.txt", "generated.json")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	err = validateStagedCandidate(
		context.Background(), snapshot, baseline,
		[]PathRecord{{Path: "tracked.txt", Status: "M"}}, nil,
		map[string]struct{}{"generated.json": {}},
	)
	if err != nil {
		t.Fatal(err)
	}
}

func TestValidateStagedCandidateRejectsWorktreeChangeAfterStage(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "tracked.txt", "staged\n")
	runCoverageGit(t, repoRoot, "add", "--", "tracked.txt")
	writeShipFixture(t, repoRoot, "tracked.txt", "changed after verification\n")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	err = validateStagedCandidate(context.Background(), snapshot, baseline, []PathRecord{{Path: "tracked.txt", Status: "M"}}, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_SHIP_WORKTREE_DRIFT") {
		t.Fatalf("expected worktree drift rejection, got %v", err)
	}
}

func TestValidateStagedCandidateRejectsExtraStagedPath(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "tracked.txt", "verified\n")
	writeShipFixture(t, repoRoot, "extra.txt", "extra\n")
	runCoverageGit(t, repoRoot, "add", "--", "tracked.txt", "extra.txt")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	err = validateStagedCandidate(context.Background(), snapshot, baseline, []PathRecord{{Path: "tracked.txt", Status: "M"}}, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "AIDD_SHIP_PATH_EXTRA") {
		t.Fatalf("expected extra staged path rejection, got %v", err)
	}
}

func TestValidateStagedCandidateRejectsUnstagedCanonicalOutput(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "tracked.txt", "verified\n")
	writeShipFixture(t, repoRoot, "generated.json", "{}\n")
	runCoverageGit(t, repoRoot, "add", "--", "tracked.txt")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	err = validateStagedCandidate(
		context.Background(), snapshot, baseline,
		[]PathRecord{{Path: "tracked.txt", Status: "M"}}, nil,
		map[string]struct{}{"generated.json": {}},
	)
	if err == nil || !strings.Contains(err.Error(), "AIDD_SHIP_UNSTAGED_PATH") {
		t.Fatalf("expected unstaged canonical output rejection, got %v", err)
	}
}

func TestValidateStagedCandidateIncludesGitMode(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	if err := os.Chmod(filepath.Join(repoRoot, "tracked.txt"), 0o755); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "--", "tracked.txt")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	if err := validateStagedCandidate(context.Background(), snapshot, baseline, []PathRecord{{Path: "tracked.txt", Status: "M"}}, nil, nil); err != nil {
		t.Fatal(err)
	}
}

func TestValidateStagedCandidateAcceptsNewAndDeletedPaths(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "added.txt", "added\n")
	if err := os.Remove(filepath.Join(repoRoot, "tracked.txt")); err != nil {
		t.Fatal(err)
	}
	runCoverageGit(t, repoRoot, "add", "--all", "--", "added.txt", "tracked.txt")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	err = validateStagedCandidate(context.Background(), snapshot, baseline, []PathRecord{
		{Path: "added.txt", Status: "A"},
		{Path: "tracked.txt", Status: "D"},
	}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
}

func TestValidateStagedCandidateAcceptsModifiedDesignUntrackedPath(t *testing.T) {
	repoRoot, baseline := coverageFixtureRepository(t)
	writeShipFixture(t, repoRoot, "design-untracked.txt", "before\n")
	baselineSnapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	untrackedBaseline, err := state.UntrackedInventory(context.Background(), baselineSnapshot, nil)
	if closeErr := baselineSnapshot.Close(); err == nil && closeErr != nil {
		err = closeErr
	}
	if err != nil {
		t.Fatal(err)
	}
	writeShipFixture(t, repoRoot, "design-untracked.txt", "after\n")
	runCoverageGit(t, repoRoot, "add", "--", "design-untracked.txt")

	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	if err := validateStagedCandidate(context.Background(), snapshot, baseline, []PathRecord{{Path: "design-untracked.txt", Status: "M"}}, untrackedBaseline, nil); err != nil {
		t.Fatal(err)
	}
}

func writeShipFixture(t *testing.T, root, path, content string) {
	t.Helper()
	absolute := filepath.Join(root, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

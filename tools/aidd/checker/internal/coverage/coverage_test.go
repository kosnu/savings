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
)

func TestValidatePinnedInputsRejectsNonCanonicalArtifactPath(t *testing.T) {
	loaded := &receipt.Loaded{Value: model.Receipt{
		Workspace: "1671-checker",
		Artifacts: model.ReceiptArtifacts{
			Requirements: model.ArtifactPair{Source: model.PathHash{Path: "outside.json"}},
		},
	}}
	err := validatePinnedInputs(&repository.Snapshot{}, loaded, &rules.Loaded{})
	if err == nil || !strings.Contains(err.Error(), "AIDD_ARTIFACT_PATH") {
		t.Fatalf("expected canonical artifact path rejection, got %v", err)
	}
}

func TestChangedPathsRejectsBaselineOutsideCurrentHistory(t *testing.T) {
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
	_, err = changedPaths(context.Background(), snapshot, baseline)
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_BASELINE_ANCESTRY") {
		t.Fatalf("expected baseline ancestry rejection, got %v", err)
	}
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

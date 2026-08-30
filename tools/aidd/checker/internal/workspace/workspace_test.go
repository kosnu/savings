package workspace

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestNormalizeTitleUsesNFKCAndCaseFold(t *testing.T) {
	actual := normalizeTitle(" ＡＩＤＤ Straße　")
	if actual != "aidd strasse" {
		t.Fatalf("unexpected normalized title: %q", actual)
	}
}

func TestResolveDerivesFirstWorkspaceFromCompleteNormalizedTitle(t *testing.T) {
	snapshot := workspaceRepository(t, nil, nil)
	actual, err := Resolve(context.Background(), snapshot, "owner/repo#1563", "  Sync Language Setting / 言語設定  ")
	if err != nil {
		t.Fatal(err)
	}
	if actual != "1563-sync-language-setting-86153b5ef15b" {
		t.Fatalf("unexpected workspace: %s", actual)
	}
}

func TestResolveRejectsPartialIssueIdentity(t *testing.T) {
	snapshot := workspaceRepository(t, nil, nil)
	_, err := Resolve(context.Background(), snapshot, "not-an-owner-repo#1671", "title")
	if err == nil || !strings.Contains(err.Error(), "AIDD_ISSUE_ID") {
		t.Fatalf("expected exact Issue identity rejection, got %v", err)
	}
}

func TestResolveReusesTrackedWorkspaceAfterTitleChange(t *testing.T) {
	snapshot := workspaceRepository(t, []string{"1563-sync-language-setting"}, nil)
	actual, err := Resolve(context.Background(), snapshot, "owner/repo#1563", "Changed title does not rename the existing workspace")
	if err != nil {
		t.Fatal(err)
	}
	if actual != "1563-sync-language-setting" {
		t.Fatalf("unexpected reused workspace: %s", actual)
	}
}

func TestResolveAcceptsOnlyCanonicalUntrackedFirstWorkspace(t *testing.T) {
	const canonical = "1563-sync-language-setting-86153b5ef15b"
	snapshot := workspaceRepository(t, nil, []string{canonical})
	actual, err := Resolve(context.Background(), snapshot, "owner/repo#1563", "Sync Language Setting / 言語設定")
	if err != nil {
		t.Fatal(err)
	}
	if actual != canonical {
		t.Fatalf("unexpected canonical workspace: %s", actual)
	}

	snapshot = workspaceRepository(t, nil, []string{"1563-sync-language-setting-attempt-2"})
	_, err = Resolve(context.Background(), snapshot, "owner/repo#1563", "Sync Language Setting / 言語設定")
	if err == nil || !strings.Contains(err.Error(), "AIDD_WORKSPACE_IDENTITY") {
		t.Fatalf("expected arbitrary untracked workspace rejection, got %v", err)
	}
}

func TestResolveRejectsMultipleTrackedOrUntrackedWorkspaces(t *testing.T) {
	for _, test := range []struct {
		name      string
		issue     string
		tracked   []string
		untracked []string
	}{
		{name: "tracked", issue: "owner/repo#1492", tracked: []string{"1492-month-navigation", "1492-month-navigation-v2"}},
		{name: "mixed", issue: "owner/repo#1563", tracked: []string{"1563-sync-language-setting"}, untracked: []string{"1563-language-setting-follow-up"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			snapshot := workspaceRepository(t, test.tracked, test.untracked)
			_, err := Resolve(context.Background(), snapshot, test.issue, "title")
			if err == nil || !strings.Contains(err.Error(), "AIDD_WORKSPACE_AMBIGUOUS") {
				t.Fatalf("expected ambiguous workspace rejection, got %v", err)
			}
		})
	}
}

func TestResolveRejectsNonCanonicalWorkspaceName(t *testing.T) {
	snapshot := workspaceRepository(t, []string{"1563-UPPER"}, nil)
	_, err := Resolve(context.Background(), snapshot, "owner/repo#1563", "title")
	if err == nil || !strings.Contains(err.Error(), "AIDD_WORKSPACE") {
		t.Fatalf("expected canonical workspace name rejection, got %v", err)
	}
}

func workspaceRepository(t *testing.T, tracked, untracked []string) *repository.Snapshot {
	t.Helper()
	root := t.TempDir()
	runWorkspaceGit(t, root, "init", "--quiet")
	runWorkspaceGit(t, root, "config", "user.name", "AIDD Test")
	runWorkspaceGit(t, root, "config", "user.email", "aidd@example.com")
	for _, name := range tracked {
		path := filepath.Join(root, "docs", "ai-driven-development", "workspaces", name, "requirements.md")
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("# Requirements\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	runWorkspaceGit(t, root, "add", ".")
	runWorkspaceGit(t, root, "commit", "--allow-empty", "-qm", "fixture")
	for _, name := range untracked {
		path := filepath.Join(root, "docs", "ai-driven-development", "workspaces", name)
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	snapshot, err := repository.Open(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = snapshot.Close() })
	return snapshot
}

func runWorkspaceGit(t *testing.T, root string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
}

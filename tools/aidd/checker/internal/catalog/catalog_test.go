package catalog

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestRepositoryCatalogLoadsWithDistinctSuiteAndTestCaseProfiles(t *testing.T) {
	workingDirectory, err := filepath.Abs(".")
	if err != nil {
		t.Fatal(err)
	}
	repoRoot := filepath.Clean(filepath.Join(workingDirectory, "../../../../.."))
	snapshot, err := repository.Open(context.Background(), repoRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	loaded, err := Load(snapshot, DefaultPath)
	if err != nil {
		t.Fatal(err)
	}
	suite := loaded.Profiles["web-unit-integration-suite"]
	testCase := loaded.Profiles["web-vitest-unit-integration"]
	gitDiff := loaded.Profiles["git-diff-check"]
	if suite.Contract != "suite" || suite.Runner != "command_suite" {
		t.Fatalf("unexpected suite profile: %#v", suite)
	}
	if testCase.Contract != "test_case" || testCase.Runner != "vitest_json" {
		t.Fatalf("unexpected test-case profile: %#v", testCase)
	}
	if loaded.ProfileHash[suite.ID] == loaded.ProfileHash[testCase.ID] {
		t.Fatal("suite and test-case profiles must have distinct identities")
	}
	if strings.Join(gitDiff.Argv, "\x00") != strings.Join([]string{"git", "diff", "--no-ext-diff", "HEAD", "--check", "--"}, "\x00") {
		t.Fatalf("git-diff-check does not inspect HEAD through the final worktree: %#v", gitDiff.Argv)
	}
}

func TestRunnerSpecificArgvShapesAreFailClosed(t *testing.T) {
	tests := []model.VerificationProfile{
		{Runner: "python_unittest", Argv: []string{"python3", "-m", "unittest", "-v", "arbitrary.target"}},
		{Runner: "vitest_json", Argv: []string{"pnpm", "run", "test", "--reporter=default"}},
		{Runner: "vitest_json", Argv: []string{"npx", "vitest"}},
		{ID: "git-diff-check", Contract: "suite", Runner: "command_suite", SelectorKind: "suite", Argv: []string{"git", "diff", "--check"}},
	}
	for _, profile := range tests {
		if err := validateRunnerArgv(profile, "profiles[0]"); err == nil {
			t.Fatalf("expected argv rejection: %#v", profile)
		}
	}
}

func TestResolveRejectsSelectorOutsideProfileRoot(t *testing.T) {
	profile := model.VerificationProfile{ID: "web-test", Contract: "test_case", SelectorKind: "test_case", SelectorRoot: "apps/web"}
	resolved := &Resolved{Profiles: map[string]model.VerificationProfile{profile.ID: profile}, ProfileHash: map[string]string{profile.ID: "hash"}}
	cases := []model.VerificationCase{{
		ID: "VC-1", Type: "automated", VerificationProfileID: profile.ID,
		Selector: &model.Selector{Kind: "test_case", Path: "apps/api/test.ts", Name: "test"},
	}}
	_, err := Resolve(resolved, cases)
	if err == nil || !strings.Contains(err.Error(), "AIDD_SELECTOR_ROOT") {
		t.Fatalf("expected selector-root diagnostic, got %v", err)
	}
}

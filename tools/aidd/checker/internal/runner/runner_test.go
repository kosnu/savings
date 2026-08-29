package runner

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestVitestRuntimeIdentityMustExactlyMatch(t *testing.T) {
	snapshot := newRunnerSnapshot(t)
	repoRoot := snapshot.Root
	testPath := filepath.Join(repoRoot, "apps", "web", "src", "feature.test.ts")
	if err := os.MkdirAll(filepath.Dir(testPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(testPath, []byte("test source\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	reportPath := filepath.Join(t.TempDir(), "vitest.json")
	report := map[string]any{
		"testResults": []any{map[string]any{
			"name":             testPath,
			"assertionResults": []any{map[string]any{"fullName": "target behavior", "status": "passed"}},
		}},
	}
	content, _ := json.Marshal(report)
	if err := os.WriteFile(reportPath, content, 0o644); err != nil {
		t.Fatal(err)
	}
	profile := model.VerificationProfile{ID: "web-vitest", Contract: "test_case", Runner: "vitest_json", SelectorKind: "test_case", SelectorRoot: "apps/web", WorkingDirectory: "apps/web", Argv: []string{"pnpm"}}
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "automated", VerificationProfileID: profile.ID, Selector: &model.Selector{Kind: "test_case", Path: "apps/web/src/feature.test.ts", Name: "target behavior"}}
	identities, err := parseRuntimeIdentities(snapshot, profile, verificationCase, nil, nil, reportPath)
	if err != nil {
		t.Fatal(err)
	}
	if len(identities) != 1 || identities[0].Path != verificationCase.Selector.Path || identities[0].Name != verificationCase.Selector.Name {
		t.Fatalf("unexpected identities: %#v", identities)
	}

	verificationCase.Selector.Name = "another test"
	_, err = parseRuntimeIdentities(snapshot, profile, verificationCase, nil, nil, reportPath)
	if err == nil || !strings.Contains(err.Error(), "AIDD_RUNTIME_IDENTITY") {
		t.Fatalf("expected identity diagnostic, got %v", err)
	}
}

func TestVitestRuntimeIdentityRejectsNonPassedOrExtraAssertions(t *testing.T) {
	snapshot := newRunnerSnapshot(t)
	testPath := filepath.Join(snapshot.Root, "apps", "web", "src", "feature.test.ts")
	if err := os.MkdirAll(filepath.Dir(testPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(testPath, []byte("test source\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	profile := model.VerificationProfile{ID: "web-vitest", Contract: "test_case", Runner: "vitest_json", SelectorKind: "test_case", SelectorRoot: "apps/web", WorkingDirectory: "apps/web", Argv: []string{"pnpm"}}
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "automated", VerificationProfileID: profile.ID, Selector: &model.Selector{Kind: "test_case", Path: "apps/web/src/feature.test.ts", Name: "target behavior"}}
	tests := map[string][]any{
		"selected test skipped": {
			map[string]any{"fullName": "target behavior", "status": "skipped"},
		},
		"extra skipped assertion": {
			map[string]any{"fullName": "target behavior", "status": "passed"},
			map[string]any{"fullName": "other behavior", "status": "skipped"},
		},
	}
	for name, assertions := range tests {
		t.Run(name, func(t *testing.T) {
			report := map[string]any{
				"testResults": []any{map[string]any{"name": testPath, "assertionResults": assertions}},
			}
			content, err := json.Marshal(report)
			if err != nil {
				t.Fatal(err)
			}
			reportPath := filepath.Join(t.TempDir(), "vitest.json")
			if err := os.WriteFile(reportPath, content, 0o644); err != nil {
				t.Fatal(err)
			}
			_, err = parseRuntimeIdentities(snapshot, profile, verificationCase, nil, nil, reportPath)
			if err == nil || !strings.Contains(err.Error(), "AIDD_VITEST_STATUS") {
				t.Fatalf("expected Vitest status diagnostic, got %v", err)
			}
		})
	}
}

func TestPythonUnittestRuntimeIdentityMustExactlyMatch(t *testing.T) {
	snapshot := newRunnerSnapshot(t)
	profile := model.VerificationProfile{ID: "python-unittest", Contract: "test_case", Runner: "python_unittest", SelectorKind: "test_case", Argv: []string{"python3", "-m", "unittest", "-v"}}
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "automated", VerificationProfileID: profile.ID, Selector: &model.Selector{Kind: "test_case", Path: "tools/example/test_contract.py", Name: "ContractTest.test_validates_contract"}}
	stderr := []byte("test_validates_contract (tools.example.test_contract.ContractTest.test_validates_contract) ... ok\n\nRan 1 test in 0.001s\n\nOK\n")
	identities, err := parseRuntimeIdentities(snapshot, profile, verificationCase, nil, stderr, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(identities) != 1 || identities[0].Path != verificationCase.Selector.Path || identities[0].Name != verificationCase.Selector.Name {
		t.Fatalf("unexpected identities: %#v", identities)
	}

	stderr = []byte("test_other (tools.example.test_contract.ContractTest.test_other) ... ok\n")
	_, err = parseRuntimeIdentities(snapshot, profile, verificationCase, nil, stderr, "")
	if err == nil || !strings.Contains(err.Error(), "AIDD_UNITTEST_RESULT") {
		t.Fatalf("expected unittest identity diagnostic, got %v", err)
	}
}

func TestPythonUnittestTranscriptRejectsIncompleteOrExtraResults(t *testing.T) {
	expected := "tools.example.test_contract.ContractTest.test_validates_contract"
	tests := map[string]string{
		"missing summary": "test_validates_contract (" + expected + ") ... ok\n\nOK\n",
		"wrong count":     "test_validates_contract (" + expected + ") ... ok\n\nRan 2 tests in 0.001s\n\nOK\n",
		"skipped":         "test_validates_contract (" + expected + ") ... skipped 'reason'\n\nRan 1 test in 0.001s\n\nOK (skipped=1)\n",
		"extra outcome":   "test_validates_contract (" + expected + ") ... ok\ntest_other (tools.example.test_contract.ContractTest.test_other) ... ok\n\nRan 2 tests in 0.001s\n\nOK\n",
		"extra text":      "warning\ntest_validates_contract (" + expected + ") ... ok\n\nRan 1 test in 0.001s\n\nOK\n",
	}
	for name, transcript := range tests {
		t.Run(name, func(t *testing.T) {
			if err := requirePythonUnittestResult("VC-1", expected, []byte(transcript)); err == nil {
				t.Fatal("expected transcript rejection")
			}
		})
	}
}

func TestVitestArgumentsEscapeAndAnchorExactName(t *testing.T) {
	arguments := vitestArguments([]string{"pnpm", "run", "test"}, "/tmp/result.json", "src/feature.test.ts", `supports [draft] (v2)?`)
	want := `--testNamePattern=^supports \[draft\] \(v2\)\?$`
	if arguments[len(arguments)-1] != want {
		t.Fatalf("test name pattern = %q, want %q", arguments[len(arguments)-1], want)
	}
}

func TestFixedEnvironmentOverridesNondeterministicValues(t *testing.T) {
	environment := fixedEnvironment([]string{"PATH=/bin", "LC_ALL=ja_JP.UTF-8", "FORCE_COLOR=1", "PYTHONDONTWRITEBYTECODE=0"})
	for _, required := range []string{"LC_ALL=C", "FORCE_COLOR=0", "PYTHONDONTWRITEBYTECODE=1"} {
		if !slices.Contains(environment, required) {
			t.Fatalf("environment does not contain %q: %#v", required, environment)
		}
	}
	for _, forbidden := range []string{"LC_ALL=ja_JP.UTF-8", "FORCE_COLOR=1", "PYTHONDONTWRITEBYTECODE=0"} {
		if slices.Contains(environment, forbidden) {
			t.Fatalf("environment still contains %q: %#v", forbidden, environment)
		}
	}
}

func TestPythonUnittestSelectorRequiresImportableExactIdentity(t *testing.T) {
	for _, selector := range []model.Selector{
		{Kind: "test_case", Path: "tools/example/test-contract.py", Name: "ContractTest.test_validates_contract"},
		{Kind: "test_case", Path: "tools/example/test_contract.py", Name: "test_validates_contract"},
	} {
		if _, err := pythonUnittestTarget(selector); err == nil {
			t.Fatalf("expected invalid selector: %#v", selector)
		}
	}
}

func TestOutputHashFramesStreamsUnambiguously(t *testing.T) {
	first := outputHash([]byte("ab"), []byte("c"))
	second := outputHash([]byte("a"), []byte("bc"))
	if first == second {
		t.Fatal("stream framing must distinguish stdout/stderr boundaries")
	}
}

func TestParseManualObservationsRequiresSubstantiveSingleLineText(t *testing.T) {
	for name, observation := range map[string]string{
		"single character": "x",
		"punctuation only": "...（！）...",
		"multiline":        "画面表示が崩れていないことを\n確認した",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseManualObservations([]string{"VC-1=" + observation}); err == nil {
				t.Fatal("expected manual observation rejection")
			}
		})
	}
	observations, err := ParseManualObservations([]string{"VC-1=画面表示が崩れていないことを確認した"})
	if err != nil {
		t.Fatal(err)
	}
	if observations["VC-1"] != "画面表示が崩れていないことを確認した" {
		t.Fatalf("unexpected manual observation: %#v", observations)
	}
}

func TestExecuteRejectsNonSubstantiveManualObservation(t *testing.T) {
	snapshot := newRunnerSnapshot(t)
	ownedPath := filepath.Join(snapshot.Root, "owned.txt")
	if err := os.WriteFile(ownedPath, []byte("complete\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	procedure := "画面表示が崩れていないことを確認する"
	target := model.TargetState{
		VerificationCases: []model.VerificationCase{{ID: "VC-1", Type: "manual", RequirementID: "AC-1", Procedure: procedure}},
		OwnershipScopes:   []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
		Representations:   []model.Representation{{ID: "REP-1", Path: "owned.txt"}},
	}
	loaded := &receipt.Loaded{
		Value:   model.Receipt{Workspace: "fixture", TargetState: model.HashValue[model.TargetState]{Value: target}},
		SHA256:  "receipt-hash",
		Catalog: &catalog.Resolved{},
	}
	pinRunnerReceipt(t, snapshot, loaded)
	_, err := Execute(context.Background(), snapshot, loaded, Options{ManualObservations: map[string]string{"VC-1": "x"}})
	if err == nil || !strings.Contains(err.Error(), "AIDD_MANUAL_OBSERVATION") {
		t.Fatalf("expected manual observation rejection, got %v", err)
	}
	evidence, err := Execute(context.Background(), snapshot, loaded, Options{ManualObservations: map[string]string{"VC-1": "画面表示が崩れていないことを確認した"}})
	if err != nil {
		t.Fatalf("valid manual observation rejected: %v", err)
	}
	if len(evidence.Results) != 1 || evidence.Results[0].Observation != "画面表示が崩れていないことを確認した" {
		t.Fatalf("unexpected manual evidence: %#v", evidence.Results)
	}
}

func TestExecuteRejectsOwnedFileMutation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fixture uses the repository shell available on Unix runners")
	}
	snapshot := newRunnerSnapshot(t)
	ownedPath := filepath.Join(snapshot.Root, "owned.txt")
	if err := os.WriteFile(ownedPath, []byte("before\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	profile := model.VerificationProfile{
		ID: "mutating-suite", Contract: "suite", Runner: "command_suite", SelectorKind: "suite",
		Argv: []string{"sh", "-c", "printf changed > owned.txt"},
	}
	target := model.TargetState{
		VerificationCases: []model.VerificationCase{{
			ID: "VC-1", Type: "automated", RequirementID: "FR-1", VerificationProfileID: profile.ID,
			Selector: &model.Selector{Kind: "suite"},
		}},
		OwnershipScopes: []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
		Representations: []model.Representation{{ID: "REP-1", Path: "owned.txt"}},
	}
	loaded := &receipt.Loaded{
		Value:  model.Receipt{Workspace: "fixture", TargetState: model.HashValue[model.TargetState]{Value: target}},
		SHA256: "receipt-hash",
		Catalog: &catalog.Resolved{
			Profiles:    map[string]model.VerificationProfile{profile.ID: profile},
			ProfileHash: map[string]string{profile.ID: "profile-hash"},
		},
	}
	pinRunnerReceipt(t, snapshot, loaded)
	_, err := Execute(context.Background(), snapshot, loaded, Options{})
	if err == nil || !strings.Contains(err.Error(), "AIDD_VERIFICATION_MUTATION") {
		t.Fatalf("expected mutation rejection, got %v", err)
	}
}

func TestExecuteRejectsOwnedGitIndexMutation(t *testing.T) {
	tests := []struct {
		name      string
		arguments func(t *testing.T, repoRoot string) []string
	}{
		{
			name: "mode",
			arguments: func(t *testing.T, repoRoot string) []string {
				return []string{"git", "update-index", "--chmod=+x", "owned.txt"}
			},
		},
		{
			name: "object",
			arguments: func(t *testing.T, repoRoot string) []string {
				objectID := runRunnerGitWithInput(t, repoRoot, "changed\n", "hash-object", "-w", "--stdin")
				return []string{"git", "update-index", "--cacheinfo", "100644", strings.TrimSpace(objectID), "owned.txt"}
			},
		},
		{
			name: "presence",
			arguments: func(t *testing.T, repoRoot string) []string {
				return []string{"git", "rm", "--cached", "--quiet", "--", "owned.txt"}
			},
		},
		{
			name: "outside ownership",
			arguments: func(t *testing.T, repoRoot string) []string {
				if err := os.WriteFile(filepath.Join(repoRoot, "outside.txt"), []byte("outside\n"), 0o644); err != nil {
					t.Fatal(err)
				}
				return []string{"git", "add", "--", "outside.txt"}
			},
		},
		{
			name: "index flags",
			arguments: func(t *testing.T, repoRoot string) []string {
				return []string{"git", "update-index", "--assume-unchanged", "owned.txt"}
			},
		},
		{
			name: "head reference",
			arguments: func(t *testing.T, repoRoot string) []string {
				runRunnerGit(t, repoRoot, "branch", "same-head")
				return []string{"git", "symbolic-ref", "HEAD", "refs/heads/same-head"}
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			snapshot := newRunnerSnapshot(t)
			ownedPath := filepath.Join(snapshot.Root, "owned.txt")
			if err := os.WriteFile(ownedPath, []byte("before\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			runRunnerGit(t, snapshot.Root, "add", "--", "owned.txt")
			profile := model.VerificationProfile{
				ID: "mutating-suite", Contract: "suite", Runner: "command_suite", SelectorKind: "suite",
				Argv: test.arguments(t, snapshot.Root),
			}
			target := model.TargetState{
				VerificationCases: []model.VerificationCase{{
					ID: "VC-1", Type: "automated", RequirementID: "FR-1", VerificationProfileID: profile.ID,
					Selector: &model.Selector{Kind: "suite"},
				}},
				OwnershipScopes: []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
				Representations: []model.Representation{{ID: "REP-1", Path: "owned.txt"}},
			}
			loaded := &receipt.Loaded{
				Value:  model.Receipt{Workspace: "fixture", TargetState: model.HashValue[model.TargetState]{Value: target}},
				SHA256: "receipt-hash",
				Catalog: &catalog.Resolved{
					Profiles:    map[string]model.VerificationProfile{profile.ID: profile},
					ProfileHash: map[string]string{profile.ID: "profile-hash"},
				},
			}
			pinRunnerReceipt(t, snapshot, loaded)
			_, err := Execute(context.Background(), snapshot, loaded, Options{})
			if err == nil || !strings.Contains(err.Error(), "AIDD_VERIFICATION_MUTATION") {
				t.Fatalf("expected Git index mutation rejection, got %v", err)
			}
		})
	}
}

func TestExecuteRejectsIgnoredRepositoryMutations(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fixture uses the repository shell available on Unix runners")
	}
	tests := []struct {
		name         string
		command      string
		wantMutation bool
	}{
		{name: "new ignored file", command: "printf new > ignored/new.txt", wantMutation: true},
		{name: "same size rewrite with restored mtime", command: "printf 'after!\\n' > ignored/existing.txt && touch -r reference.txt ignored/existing.txt", wantMutation: true},
		{name: "delete ignored file", command: "rm ignored/existing.txt", wantMutation: true},
		{name: "create then delete ignored file", command: "printf transient > ignored/transient.txt && rm ignored/transient.txt", wantMutation: true},
		{name: "unchanged repository", command: "git diff --check", wantMutation: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			snapshot := newRunnerSnapshot(t)
			for path, content := range map[string]string{
				".gitignore":           "ignored/\n",
				"owned.txt":            "complete\n",
				"reference.txt":        "reference\n",
				"ignored/existing.txt": "before\n",
			} {
				absolute := filepath.Join(snapshot.Root, filepath.FromSlash(path))
				if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			fixedTime := time.Unix(1_700_000_000, 0)
			for _, path := range []string{"reference.txt", "ignored/existing.txt"} {
				if err := os.Chtimes(filepath.Join(snapshot.Root, filepath.FromSlash(path)), fixedTime, fixedTime); err != nil {
					t.Fatal(err)
				}
			}
			runRunnerGit(t, snapshot.Root, "add", ".gitignore", "owned.txt", "reference.txt")
			runRunnerGit(t, snapshot.Root, "commit", "-qm", "runner fixture")

			profile := model.VerificationProfile{
				ID: "suite", Contract: "suite", Runner: "command_suite", SelectorKind: "suite",
				Argv: []string{"sh", "-c", test.command},
			}
			target := model.TargetState{
				VerificationCases: []model.VerificationCase{{
					ID: "VC-1", Type: "automated", RequirementID: "FR-1", VerificationProfileID: profile.ID,
					Selector: &model.Selector{Kind: "suite"},
				}},
				OwnershipScopes: []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
				Representations: []model.Representation{{ID: "REP-1", Path: "owned.txt"}},
			}
			loaded := &receipt.Loaded{
				Value: model.Receipt{Workspace: "fixture", TargetState: model.HashValue[model.TargetState]{Value: target}},
				Catalog: &catalog.Resolved{
					Profiles: map[string]model.VerificationProfile{profile.ID: profile}, ProfileHash: map[string]string{profile.ID: "profile-hash"},
				},
			}
			pinRunnerReceipt(t, snapshot, loaded)
			_, err := Execute(context.Background(), snapshot, loaded, Options{})
			if test.wantMutation {
				if err == nil || !strings.Contains(err.Error(), "AIDD_VERIFICATION_MUTATION") {
					t.Fatalf("expected ignored mutation rejection, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unchanged verification rejected: %v", err)
			}
		})
	}
}

func TestExecuteRejectsReceiptHeadMismatchBeforeVerification(t *testing.T) {
	snapshot := newRunnerSnapshot(t)
	loaded := &receipt.Loaded{Value: model.Receipt{BuildBaseline: model.BuildBaseline{Head: strings.Repeat("0", 40)}}}
	_, err := Execute(context.Background(), snapshot, loaded, Options{})
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_HEAD_DRIFT") {
		t.Fatalf("expected receipt HEAD mismatch rejection, got %v", err)
	}
}

func pinRunnerReceipt(t *testing.T, snapshot *repository.Snapshot, loaded *receipt.Loaded) {
	t.Helper()
	head, err := snapshot.Head(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	loaded.Value.BuildBaseline.Head = head
}

func newRunnerSnapshot(t *testing.T) *repository.Snapshot {
	t.Helper()
	root := t.TempDir()
	command := exec.Command("git", "init", "--quiet", root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}
	runRunnerGit(t, root, "config", "user.name", "AIDD Test")
	runRunnerGit(t, root, "config", "user.email", "aidd@example.com")
	runRunnerGit(t, root, "commit", "--allow-empty", "-qm", "initial")
	snapshot, err := repository.Open(context.Background(), root)
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

func runRunnerGit(t *testing.T, repoRoot string, arguments ...string) string {
	t.Helper()
	return runRunnerGitWithInput(t, repoRoot, "", arguments...)
}

func runRunnerGitWithInput(t *testing.T, repoRoot, input string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", repoRoot}, arguments...)...)
	command.Stdin = strings.NewReader(input)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

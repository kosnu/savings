package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestValidateSourceCLIReadsLegacyV3WithoutWriting(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "design-doc.json")
	content := []byte(`{"schema_version":3,"kind":"design","workspace":"legacy","display":{},"validation":{}}`)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := run(context.Background(), []string{"validate-source", "--source", path, "--kind", "design"}); err != nil {
		t.Fatal(err)
	}
	current, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(current) != string(content) {
		t.Fatal("validate-source changed its input")
	}
}

func TestCLIFlagErrorsUseStructuredDiagnostic(t *testing.T) {
	err := run(context.Background(), []string{"validate-source", "--repo-root", "/tmp"})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_CLI_FLAGS" || item.Path != "validate-source" || item.Artifact != "cli" {
		t.Fatalf("expected structured CLI flag diagnostic, got %#v", err)
	}
}

func TestValidateDesignRejectsCallerSuppliedIssueTitle(t *testing.T) {
	err := run(context.Background(), []string{"validate-design", "--issue-title", "stale title"})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_CLI_FLAGS" {
		t.Fatalf("expected caller-supplied Design title rejection, got %#v", err)
	}
}

func TestValidateDesignDoesNotRequireIssueTitle(t *testing.T) {
	err := run(context.Background(), []string{
		"validate-design", "--repo-root", "missing", "--workspace", "1671-checker",
		"--issue", "owner/repo#1671", "--issue-url", "https://github.com/owner/repo/issues/1671",
		"--issue-updated-at", "2026-08-28T00:00:00Z", "--issue-body", "missing",
		"--requirements", "missing", "--document", "missing", "--kind", "design",
	})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code == "AIDD_CLI_ARGUMENT" {
		t.Fatalf("validate-design still requires a caller-supplied title: %#v", err)
	}
}

func TestArtifactGatesRejectExternalCanonicalSourceSubstitutes(t *testing.T) {
	root := t.TempDir()
	initializeMainRepository(t, root)
	workspace := "1671-checker"
	requirementsPath := "docs/ai-driven-development/workspaces/" + workspace + "/requirements.json"
	writeMainFile(t, root, requirementsPath, []byte("{}\n"))
	issueBodyPath := filepath.Join(t.TempDir(), "issue-body.txt")
	externalRequirementsPath := filepath.Join(t.TempDir(), "requirements.json")
	externalDesignPath := filepath.Join(t.TempDir(), "design-doc.json")
	for path, content := range map[string][]byte{
		issueBodyPath:            []byte("checker contract\n"),
		externalRequirementsPath: []byte("{}\n"),
		externalDesignPath:       []byte("{}\n"),
	} {
		if err := os.WriteFile(path, content, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	tests := []struct {
		name     string
		args     []string
		wantPath string
	}{
		{
			name: "Requirements artifact document",
			args: []string{
				"validate-requirements", "--repo-root", root, "--workspace", workspace,
				"--issue", "owner/repo#1671", "--issue-title", "AIDD Checker",
				"--issue-url", "https://github.com/owner/repo/issues/1671", "--issue-updated-at", "2026-08-29T00:00:00Z",
				"--issue-body", issueBodyPath, "--document", externalRequirementsPath, "--kind", "requirements",
			},
			wantPath: "--document",
		},
		{
			name: "Design Goal Requirements",
			args: []string{
				"validate-design", "--repo-root", root, "--workspace", workspace,
				"--issue", "owner/repo#1671", "--issue-url", "https://github.com/owner/repo/issues/1671",
				"--issue-updated-at", "2026-08-29T00:00:00Z", "--issue-body", issueBodyPath,
				"--requirements", externalRequirementsPath, "--document", externalDesignPath, "--kind", "design_goal",
			},
			wantPath: "--requirements",
		},
		{
			name: "Design artifact document",
			args: []string{
				"validate-design", "--repo-root", root, "--workspace", workspace,
				"--issue", "owner/repo#1671", "--issue-url", "https://github.com/owner/repo/issues/1671",
				"--issue-updated-at", "2026-08-29T00:00:00Z", "--issue-body", issueBodyPath,
				"--requirements", requirementsPath, "--document", externalDesignPath, "--kind", "design",
			},
			wantPath: "--document",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := run(context.Background(), test.args)
			item, ok := err.(*diagnostic.Diagnostic)
			if !ok || item.Code != "AIDD_CLI_ARTIFACT_PATH" || item.Path != test.wantPath {
				t.Fatalf("expected AIDD_CLI_ARTIFACT_PATH for %s, got %#v", test.wantPath, err)
			}
		})
	}
}

func TestCheckAllRejectsSymlinkWorkspace(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := t.TempDir()
	initializeMainRepository(t, root)
	workspaces := filepath.Join(root, "docs", "ai-driven-development", "workspaces")
	if err := os.MkdirAll(filepath.Join(workspaces, "real"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("real", filepath.Join(workspaces, "1671-linked")); err != nil {
		t.Fatal(err)
	}

	err := run(context.Background(), []string{"check-all", "--repo-root", root})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_PATH_SYMLINK" {
		t.Fatalf("expected AIDD_PATH_SYMLINK, got %#v", err)
	}
}

func TestCheckAllRejectsTrackedManagedSourceDeletion(t *testing.T) {
	root := t.TempDir()
	initializeMainRepository(t, root)
	sourcePath := filepath.Join(root, "docs", "ai-driven-development", "workspaces", "1671-checker", "requirements.json")
	writeMainFile(t, root, "docs/ai-driven-development/workspaces/1671-checker/requirements.json", []byte("{}\n"))
	runMainGit(t, root, "add", ".")
	runMainGit(t, root, "commit", "-qm", "managed source")
	if err := os.Remove(sourcePath); err != nil {
		t.Fatal(err)
	}
	err := run(context.Background(), []string{"check-all", "--repo-root", root})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_SOURCE_MISSING" {
		t.Fatalf("expected AIDD_SOURCE_MISSING, got %#v", err)
	}
}

func TestCheckAllRejectsGitHeadSymlinkHiddenByCurrentRegularFile(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := t.TempDir()
	initializeMainRepository(t, root)
	relative := "docs/ai-driven-development/workspaces/1671-checker/requirements.json"
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("outside.json", path); err != nil {
		t.Fatal(err)
	}
	runMainGit(t, root, "add", relative)
	runMainGit(t, root, "commit", "-qm", "managed symlink source")
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	writeMainFile(t, root, relative, []byte("{}\n"))

	err := run(context.Background(), []string{"check-all", "--repo-root", root})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_GIT_HEAD_TYPE" {
		t.Fatalf("expected AIDD_GIT_HEAD_TYPE, got %#v", err)
	}
}

func TestCheckAllRejectsGoalAtCanonicalArtifactSourcePath(t *testing.T) {
	root := t.TempDir()
	initializeMainRepository(t, root)
	writeMainFile(t, root, "docs/ai-driven-development/workspaces/1671-checker/requirements.json", []byte(`{"schema_version":4,"kind":"requirements_goal","workspace":"1671-checker","display":{},"validation":{}}`))
	runMainGit(t, root, "add", ".")
	runMainGit(t, root, "commit", "-qm", "goal at artifact path")
	err := run(context.Background(), []string{"check-all", "--repo-root", root})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != "AIDD_SOURCE_KIND" {
		t.Fatalf("expected AIDD_SOURCE_KIND, got %#v", err)
	}
}

func TestCheckAllRejectsSelfContainedSemanticContractBypasses(t *testing.T) {
	tests := []struct {
		name     string
		file     string
		source   map[string]any
		wantCode string
	}{
		{
			name: "empty direct rule inventory",
			file: "requirements.json",
			source: map[string]any{
				"schema_version": 4, "kind": "requirements", "workspace": "1671-checker",
				"display": map[string]any{"path": "requirements.md", "preamble": "# Requirements"},
				"validation": map[string]any{
					"mode": "managed", "cycle_start_issue_title": "AIDD Checker",
					"input_gate": map[string]any{
						"task_context": map[string]any{"source": "issue_body", "issue": "owner/repo#1671", "url": "https://github.com/owner/repo/issues/1671", "updated_at": "2026-08-28T00:00:00Z", "body_sha256": strings.Repeat("0", 64)},
						"direct_rules": []any{}, "depends_on": []any{},
					},
					"completeness_gate": map[string]any{
						"issue_body_sha256": strings.Repeat("0", 64), "workspace": "1671-checker", "baseline": map[string]any{"source": "none", "body_sha256": nil},
						"requirements": []any{map[string]any{"id": "FR-1", "status": "new", "issue_evidence": "checker"}}, "sections": []any{map[string]any{"id": "functional", "status": "new", "issue_evidence": "checker"}}, "retired": []any{},
					},
					"requirements": []any{map[string]any{"id": "FR-1", "section_id": "functional", "text": "checker契約を厳密に検証する"}},
					"sections":     []any{map[string]any{"id": "functional", "heading": "機能要件", "blocks": []any{map[string]any{"id": "functional-requirements", "type": "requirements"}}}},
				},
			},
			wantCode: "AIDD_DIRECT_RULES_EMPTY",
		},
		{
			name: "unowned product behavior",
			file: "design-doc.json",
			source: map[string]any{
				"schema_version": 4, "kind": "design", "workspace": "1671-checker",
				"display": map[string]any{"path": "design-doc.md", "preamble": "# Design"},
				"validation": map[string]any{
					"mode": "managed",
					"sections": []any{map[string]any{"id": "architecture", "heading": "Architecture", "blocks": []any{
						map[string]any{"id": "fr-1-design", "type": "evidence", "role": "design", "owner_id": "FR-1", "text": "設計根拠を十分に記録する。", "product_behavior_ids": []any{}},
						map[string]any{"id": "fr-1-verification", "type": "evidence", "role": "verification", "owner_id": "FR-1", "text": "検証根拠を十分に記録する。"},
					}}},
					"target_state": model.TargetState{
						ProductBehaviors:  []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "profile固定後の最終状態になる", RequirementID: "FR-1"}},
						VerificationCases: []model.VerificationCase{{ID: "VC-1", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationProfileID: "git-diff-check", Selector: &model.Selector{Kind: "suite"}}},
						OwnershipScopes:   []model.OwnershipScope{{Path: "tool.go", Kind: "file"}, {Path: "tool_test.go", Kind: "file"}},
						Representations: []model.Representation{
							{ID: "REP-1", Kind: "implementation", Path: "tool.go", Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{}},
							{ID: "REP-2", Kind: "test", Path: "tool_test.go", Locator: model.Locator{Kind: "test_case", Name: "profile evidence"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{}, VerificationCaseIDs: []string{"VC-1"}},
						},
					},
					"rule_coverage": map[string]any{"implementation_surfaces": []any{}, "additional_rules": []any{}},
					"coverage_gate": map[string]any{
						"requirements_sha256": strings.Repeat("0", 64), "workspace": "1671-checker", "requirement_ids": []any{"FR-1"}, "baseline": map[string]any{"source": "none", "body_sha256": nil},
						"coverage": []any{map[string]any{"id": "FR-1", "design_block_id": "fr-1-design", "verification_block_id": "fr-1-verification"}}, "baseline_sections": []any{},
					},
				},
			},
			wantCode: "AIDD_BEHAVIOR_EVIDENCE_INVENTORY",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			initializeMainRepository(t, root)
			content, err := canonical.Pretty(test.source)
			if err != nil {
				t.Fatal(err)
			}
			writeMainFile(t, root, "docs/ai-driven-development/workspaces/1671-checker/"+test.file, content)
			err = run(context.Background(), []string{"check-all", "--repo-root", root})
			item, ok := err.(*diagnostic.Diagnostic)
			if !ok || item.Code != test.wantCode {
				t.Fatalf("expected %s, got %#v", test.wantCode, err)
			}
		})
	}
}

func TestCheckAllIgnoresHistoricalMarkdownOnlyWorkspace(t *testing.T) {
	root := t.TempDir()
	initializeMainRepository(t, root)
	writeMainFile(t, root, "docs/ai-driven-development/workspaces/1492-legacy/requirements.md", []byte("# Historical Requirements\n"))
	runMainGit(t, root, "add", ".")
	runMainGit(t, root, "commit", "-qm", "historical workspace")
	if err := run(context.Background(), []string{"check-all", "--repo-root", root}); err != nil {
		t.Fatal(err)
	}
}

func TestEveryPublicSubcommandHasStableDispatch(t *testing.T) {
	want := []string{"workspace", "render", "validate-source", "validate-requirements", "validate-design", "check-all", "capture-design", "build-entry", "capture-verification", "validate-build", "validate-phase-contract", "version"}
	if !slices.Equal(commands(), want) {
		t.Fatalf("commands() = %#v, want %#v", commands(), want)
	}
	for _, command := range want {
		t.Run(command, func(t *testing.T) {
			err := run(context.Background(), []string{command})
			if command == "version" {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			item, ok := err.(*diagnostic.Diagnostic)
			if !ok {
				t.Fatalf("expected structured argument diagnostic, got %#v", err)
			}
			if item.Code == "AIDD_CLI_COMMAND" {
				t.Fatalf("public command was not dispatched: %#v", item)
			}
		})
	}
}

func TestCaptureVerificationCLIRejectsIgnoredMutationWithoutWritingEvidence(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fixture uses the repository shell available on Unix runners")
	}
	assertCaptureVerificationFailure(t, []string{"sh", "-c", "printf mutation > ignored/new.txt"}, "AIDD_VERIFICATION_MUTATION")
}

func TestCaptureVerificationCLIRejectsResidualProcessBeforeLateMutation(t *testing.T) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		t.Skip("verification process groups are supported on Darwin and Linux")
	}
	root := assertCaptureVerificationFailure(t, []string{"sh", "-c", "(sleep 1; printf late > ignored/late.txt) >/dev/null 2>&1 &"}, "AIDD_VERIFICATION_PROCESS_LEAK")
	time.Sleep(1200 * time.Millisecond)
	latePath := filepath.Join(root, "ignored", "late.txt")
	if _, err := os.Stat(latePath); !os.IsNotExist(err) {
		t.Fatalf("residual verification process mutated the repository after rejection: %v", err)
	}
}

func TestWriteBuildArtifactRejectsHeadDriftBeforeOutput(t *testing.T) {
	root := t.TempDir()
	initializeMainRepository(t, root)
	baseline := strings.TrimSpace(runMainGit(t, root, "rev-parse", "HEAD"))
	snapshot, err := repository.Open(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Close()
	runMainGit(t, root, "commit", "--allow-empty", "-qm", "concurrent HEAD drift")
	loaded := &receipt.Loaded{Value: model.Receipt{BuildBaseline: model.BuildBaseline{Head: baseline}}}
	output := "docs/ai-driven-development/workspaces/fixture/.aidd/build-rule-coverage.json"
	err = writeBuildArtifact(context.Background(), snapshot, loaded, output, []byte("{}\n"))
	if err == nil || !strings.Contains(err.Error(), "AIDD_BUILD_HEAD_DRIFT") {
		t.Fatalf("expected pre-output HEAD drift rejection, got %v", err)
	}
	if _, statErr := os.Stat(filepath.Join(root, filepath.FromSlash(output))); !os.IsNotExist(statErr) {
		t.Fatalf("HEAD drift wrote build output: %v", statErr)
	}
}

func assertCaptureVerificationFailure(t *testing.T, arguments []string, diagnosticCode string) string {
	t.Helper()
	root := t.TempDir()
	runMainGit(t, root, "init", "--quiet")
	runMainGit(t, root, "config", "user.name", "AIDD Test")
	runMainGit(t, root, "config", "user.email", "aidd@example.com")
	writeMainFile(t, root, ".gitignore", []byte("ignored/\n"))
	writeMainFile(t, root, "owned.txt", []byte("complete\n"))
	if err := os.MkdirAll(filepath.Join(root, "ignored"), 0o755); err != nil {
		t.Fatal(err)
	}
	runMainGit(t, root, "add", ".gitignore", "owned.txt")
	runMainGit(t, root, "commit", "-qm", "fixture")
	head := strings.TrimSpace(runMainGit(t, root, "rev-parse", "HEAD"))

	profile := model.VerificationProfile{
		ID: "mutating-suite", Contract: "suite", Runner: "command_suite", SelectorKind: "suite",
		Argv: arguments,
	}
	catalogValue := model.ProfileCatalog{SchemaVersion: model.ProfileSchemaVersion, Profiles: []model.VerificationProfile{profile}}
	catalogBytes, err := canonical.Pretty(catalogValue)
	if err != nil {
		t.Fatal(err)
	}
	writeMainFile(t, root, catalog.DefaultPath, catalogBytes)
	profileHash, err := canonical.Hash(profile)
	if err != nil {
		t.Fatal(err)
	}
	target := model.TargetState{
		ProductBehaviors: []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "検証済みの完成状態を維持する", RequirementID: "FR-1"}},
		VerificationCases: []model.VerificationCase{{
			ID: "VC-1", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"},
			VerificationProfileID: profile.ID, Selector: &model.Selector{Kind: "suite"},
		}},
		OwnershipScopes: []model.OwnershipScope{{Path: "owned.txt", Kind: "file"}},
		Representations: []model.Representation{{
			ID: "REP-1", Kind: "implementation", Path: "owned.txt", Locator: model.Locator{Kind: "file"},
			RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{"VC-1"},
		}},
	}
	receiptValue := model.Receipt{
		SchemaVersion: model.ReceiptSchemaVersion, Kind: "design_completion", Workspace: "fixture",
		VerificationProfiles: model.ProfileReceipt{
			Path: catalog.DefaultPath, SHA256: canonical.HashBytes(catalogBytes),
			Selected: []model.SelectedProfile{{ID: profile.ID, SHA256: profileHash}},
		},
		RuleCoverage:      mainHashValue(t, model.RuleCoverage{ImplementationSurfaces: []string{}, AdditionalRules: []model.AdditionalRule{}}),
		TargetState:       mainHashValue(t, target),
		OwnershipScopes:   mainHashValue(t, target.OwnershipScopes),
		BaselineInventory: mainHashValue(t, []string{"owned.txt"}),
		UntrackedBaseline: mainHashValue(t, []model.UntrackedEntry{}),
		BuildBaseline:     model.BuildBaseline{Head: head},
	}
	receiptBytes, err := canonical.Pretty(receiptValue)
	if err != nil {
		t.Fatal(err)
	}
	receiptPath := "docs/ai-driven-development/workspaces/fixture/.aidd/design-completion.json"
	writeMainFile(t, root, receiptPath, receiptBytes)

	err = run(context.Background(), []string{
		"capture-verification", "--repo-root", root, "--workspace", "fixture",
		"--expected-receipt-sha256", canonical.HashBytes(receiptBytes),
	})
	item, ok := err.(*diagnostic.Diagnostic)
	if !ok || item.Code != diagnosticCode {
		t.Fatalf("expected %s, got %#v", diagnosticCode, err)
	}
	evidencePath := filepath.Join(root, "docs", "ai-driven-development", "workspaces", "fixture", ".aidd", "build-verification.json")
	if _, statErr := os.Stat(evidencePath); !os.IsNotExist(statErr) {
		t.Fatalf("failed verification wrote evidence: %v", statErr)
	}
	return root
}

func mainHashValue[T any](t *testing.T, value T) model.HashValue[T] {
	t.Helper()
	digest, err := canonical.Hash(value)
	if err != nil {
		t.Fatal(err)
	}
	return model.HashValue[T]{SHA256: digest, Value: value}
}

func writeMainFile(t *testing.T, root, relative string, content []byte) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}

func runMainGit(t *testing.T, root string, arguments ...string) string {
	t.Helper()
	command := exec.Command("git", append([]string{"-C", root}, arguments...)...)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", arguments, err, output)
	}
	return string(output)
}

func initializeMainRepository(t *testing.T, root string) {
	t.Helper()
	runMainGit(t, root, "init", "--quiet")
	runMainGit(t, root, "config", "user.name", "AIDD Test")
	runMainGit(t, root, "config", "user.email", "aidd@example.com")
	runMainGit(t, root, "commit", "--allow-empty", "-qm", "fixture")
}

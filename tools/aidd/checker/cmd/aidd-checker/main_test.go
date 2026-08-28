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

func TestCheckAllRejectsSymlinkWorkspace(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink fixture requires platform-specific privileges on Windows")
	}
	root := t.TempDir()
	command := exec.Command("git", "init", "--quiet", root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git init: %v: %s", err, output)
	}
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

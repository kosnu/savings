package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
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

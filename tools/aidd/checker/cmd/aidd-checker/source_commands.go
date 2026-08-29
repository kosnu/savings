package main

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/render"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/workspace"
)

func resolveWorkspace(ctx context.Context, arguments []string) error {
	flags := newFlagSet("workspace")
	repoRoot := flags.String("repo-root", "", "repository root")
	issue := flags.String("issue", "", "Issue identity")
	issueTitle := flags.String("issue-title", "", "cycle-start Issue title")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *issue == "" || *issueTitle == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "workspace", "cli", "workspace requires --repo-root, --issue, and --issue-title", nil, arguments)
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	name, err := workspace.Resolve(ctx, snapshot, *issue, *issueTitle)
	if err != nil {
		return err
	}
	fmt.Println(name)
	return nil
}

func renderSource(ctx context.Context, arguments []string) error {
	flags := newFlagSet("render")
	repoRoot := flags.String("repo-root", "", "repository root")
	sourcePath := flags.String("source", "", "repository-relative AIDD JSON source")
	outputPath := flags.String("output", "", "repository-relative Markdown output")
	kind := flags.String("kind", "", "expected source kind")
	check := flags.Bool("check", false, "verify output without writing")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *sourcePath == "" || *outputPath == "" || *kind == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "render", "cli", "render requires --repo-root, --source, --output, and --kind", nil, arguments)
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	content, err := snapshot.Read(*sourcePath)
	if err != nil {
		return err
	}
	parsed, err := semantic.ParseSource(content, *kind, *sourcePath)
	if err != nil {
		return err
	}
	if parsed.ReadOnlyLegacy || strings.HasSuffix(parsed.Envelope.Kind, "_goal") {
		return diagnostic.New("AIDD_RENDER_KIND", "kind", *sourcePath, "render writes only active schema v4 artifact displays", []string{"requirements", "design"}, parsed.Envelope.Kind)
	}
	sourceFilename := map[string]string{"requirements": "requirements.json", "design": "design-doc.json"}[parsed.Envelope.Kind]
	displayFilename := map[string]string{"requirements": "requirements.md", "design": "design-doc.md"}[parsed.Envelope.Kind]
	expectedSourcePath, err := repository.WorkspacePath(parsed.Envelope.Workspace, sourceFilename)
	if err != nil {
		return err
	}
	expectedOutputPath, err := repository.WorkspacePath(parsed.Envelope.Workspace, displayFilename)
	if err != nil {
		return err
	}
	if *sourcePath != expectedSourcePath || *outputPath != expectedOutputPath {
		return diagnostic.New("AIDD_RENDER_PATH", "source/output", parsed.Envelope.Kind, "render requires canonical workspace source and display paths", map[string]string{"source": expectedSourcePath, "output": expectedOutputPath}, map[string]string{"source": *sourcePath, "output": *outputPath})
	}
	markdown, err := render.Markdown(content, *kind, *sourcePath)
	if err != nil {
		return err
	}
	if *check {
		actual, readErr := snapshot.Read(*outputPath)
		if readErr != nil {
			return readErr
		}
		if !bytes.Equal(actual, []byte(markdown)) {
			return diagnostic.New("AIDD_DISPLAY_DRIFT", *outputPath, *kind, "Markdown display does not match the canonical source", canonical.HashBytes([]byte(markdown)), canonical.HashBytes(actual))
		}
		if err := snapshot.AssertUnchanged(); err != nil {
			return err
		}
		fmt.Printf("AIDD display: verified: %s\n", *outputPath)
		return nil
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return err
	}
	if err := snapshot.WriteAtomic(*outputPath, []byte(markdown)); err != nil {
		return err
	}
	fmt.Printf("AIDD display: rendered: %s\n", *outputPath)
	return nil
}

func validateSource(arguments []string) error {
	flags := newFlagSet("validate-source")
	sourcePath := flags.String("source", "", "AIDD JSON source")
	kind := flags.String("kind", "", "expected source kind")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *sourcePath == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "--source", "cli", "--source is required", nil, nil)
	}
	content, err := repository.ReadExternal(*sourcePath)
	if err != nil {
		return err
	}
	parsed, err := semantic.ParseSource(content, *kind, filepath.Base(*sourcePath))
	if err != nil {
		return err
	}
	mode := "active"
	if parsed.ReadOnlyLegacy {
		mode = "read-only-legacy"
	}
	fmt.Printf("AIDD source: verified: kind=%s schema=%d compatibility=%s\n", parsed.Envelope.Kind, parsed.Envelope.SchemaVersion, mode)
	return nil
}

func checkAll(ctx context.Context, arguments []string) error {
	flags := newFlagSet("check-all")
	repoRoot := flags.String("repo-root", "", "repository root")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "check-all", "cli", "check-all requires --repo-root", "non-empty repository root", *repoRoot)
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	trackedSources, err := gitHeadManagedSources(ctx, snapshot)
	if err != nil {
		return err
	}
	trackedPaths := make([]string, 0, len(trackedSources))
	for path := range trackedSources {
		trackedPaths = append(trackedPaths, path)
	}
	sort.Strings(trackedPaths)
	for _, path := range trackedPaths {
		kind := trackedSources[path]
		if _, existsAtHead, headErr := snapshot.ReadHeadBlob(ctx, path); headErr != nil {
			return headErr
		} else if !existsAtHead {
			return diagnostic.New("AIDD_SOURCE_MISSING", path, kind, "managed artifact source disappeared from Git HEAD", "existing regular Git HEAD source", "not found")
		}
		exists, existsErr := snapshot.Exists(path)
		if existsErr != nil {
			return existsErr
		}
		if !exists {
			return diagnostic.New("AIDD_SOURCE_MISSING", path, kind, "managed artifact source tracked at Git HEAD is missing", "existing managed source", "not found")
		}
	}
	entries, err := snapshot.ReadDir("docs/ai-driven-development/workspaces")
	if err != nil {
		return err
	}
	validated := 0
	legacy := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		for _, item := range []struct{ file, kind string }{{"requirements.json", "requirements"}, {"design-doc.json", "design"}} {
			path, pathErr := repository.WorkspacePath(entry.Name(), item.file)
			if pathErr != nil {
				return pathErr
			}
			exists, existsErr := snapshot.Exists(path)
			if existsErr != nil {
				return existsErr
			}
			if !exists {
				continue
			}
			content, readErr := snapshot.Read(path)
			if readErr != nil {
				return readErr
			}
			parsed, parseErr := semantic.ParseSource(content, item.kind, path)
			if parseErr != nil {
				return parseErr
			}
			validated++
			if parsed.ReadOnlyLegacy {
				legacy++
				continue
			}
			displayPath, pathErr := repository.WorkspacePath(entry.Name(), strings.TrimSuffix(item.file, ".json")+".md")
			if pathErr != nil {
				return pathErr
			}
			expected, renderErr := render.Markdown(content, item.kind, path)
			if renderErr != nil {
				return renderErr
			}
			actual, readErr := snapshot.Read(displayPath)
			if readErr != nil {
				return readErr
			}
			if !bytes.Equal(actual, []byte(expected)) {
				return diagnostic.New("AIDD_DISPLAY_DRIFT", displayPath, item.kind, "Markdown display does not match the canonical source", canonical.HashBytes([]byte(expected)), canonical.HashBytes(actual))
			}
		}
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return err
	}
	fmt.Printf("AIDD check: verified: artifacts=%d read_only_legacy=%d\n", validated, legacy)
	return nil
}

func gitHeadManagedSources(ctx context.Context, snapshot *repository.Snapshot) (map[string]string, error) {
	const root = "docs/ai-driven-development/workspaces"
	output, err := snapshot.Git(ctx, "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", root)
	if err != nil {
		return nil, err
	}
	if len(output) > 0 && output[len(output)-1] != 0 {
		return nil, diagnostic.New("AIDD_GIT_SOURCE_LIST", root, "git", "managed source listing must use NUL-terminated paths", "NUL-terminated paths", string(output))
	}
	result := map[string]string{}
	prefix := root + "/"
	for _, raw := range bytes.Split(output, []byte{0}) {
		if len(raw) == 0 {
			continue
		}
		path, pathErr := pathcontract.ValidateRelativePath(string(raw))
		if pathErr != nil {
			return nil, pathErr
		}
		if !strings.HasPrefix(path, prefix) {
			continue
		}
		remainder := strings.TrimPrefix(path, prefix)
		parts := strings.Split(remainder, "/")
		if len(parts) != 2 {
			continue
		}
		kind := map[string]string{"requirements.json": "requirements", "design-doc.json": "design"}[parts[1]]
		if kind == "" {
			continue
		}
		expected, pathErr := repository.WorkspacePath(parts[0], parts[1])
		if pathErr != nil || expected != path {
			if pathErr != nil {
				return nil, pathErr
			}
			return nil, diagnostic.New("AIDD_GIT_SOURCE_PATH", path, "git", "managed source path is non-canonical", expected, path)
		}
		result[path] = kind
	}
	return result, nil
}

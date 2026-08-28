package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/coverage"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/gates"
	"github.com/kosnu/savings/tools/aidd/checker/internal/handoff"
	"github.com/kosnu/savings/tools/aidd/checker/internal/phasecontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/render"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/workspace"
)

const version = "0.1.0"

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		_, _ = os.Stderr.Write(diagnostic.JSON(err))
		_, _ = os.Stderr.Write([]byte("\n"))
		os.Exit(1)
	}
}

func run(ctx context.Context, arguments []string) error {
	if len(arguments) == 0 {
		return diagnostic.New("AIDD_CLI_COMMAND", "", "cli", "a subcommand is required", commands(), nil)
	}
	switch arguments[0] {
	case "version":
		if len(arguments) != 1 {
			return diagnostic.New("AIDD_CLI_FLAGS", "version", "cli", "version does not accept arguments", "no arguments", arguments[1:])
		}
		fmt.Printf("aidd-checker %s\n", version)
		return nil
	case "validate-source":
		return validateSource(arguments[1:])
	case "workspace":
		return resolveWorkspace(ctx, arguments[1:])
	case "render":
		return renderSource(ctx, arguments[1:])
	case "check-all":
		return checkAll(ctx, arguments[1:])
	case "validate-requirements":
		return validateRequirements(ctx, arguments[1:])
	case "validate-design":
		return validateDesign(ctx, arguments[1:])
	case "capture-design":
		return captureDesign(ctx, arguments[1:])
	case "build-entry":
		return buildEntry(ctx, arguments[1:])
	case "capture-verification":
		return captureVerification(ctx, arguments[1:])
	case "validate-build":
		return validateBuild(ctx, arguments[1:])
	case "validate-phase-contract":
		return validatePhaseContract(ctx, arguments[1:])
	default:
		return diagnostic.New("AIDD_CLI_COMMAND", arguments[0], "cli", "subcommand is unsupported", commands(), arguments[0])
	}
}

func commands() []string {
	return []string{"workspace", "render", "validate-source", "validate-requirements", "validate-design", "check-all", "capture-design", "build-entry", "capture-verification", "validate-build", "validate-phase-contract", "version"}
}

func validatePhaseContract(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-phase-contract")
	repoRoot := flags.String("repo-root", "", "repository root")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-phase-contract", "cli", "validate-phase-contract requires --repo-root", "non-empty repository root", *repoRoot)
	}
	if err := phasecontract.Validate(ctx, *repoRoot); err != nil {
		return err
	}
	fmt.Printf("AIDD phase contract: verified: %s\n", phasecontract.ID)
	return nil
}

func newFlagSet(name string) *flag.FlagSet {
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	return flags
}

func parseFlags(flags *flag.FlagSet, arguments []string) error {
	if err := flags.Parse(arguments); err != nil {
		return diagnostic.New("AIDD_CLI_FLAGS", flags.Name(), "cli", "command arguments are invalid", "declared flags only", err.Error())
	}
	if flags.NArg() != 0 {
		return diagnostic.New("AIDD_CLI_FLAGS", flags.Name(), "cli", "unexpected positional arguments are not allowed", "flags only", flags.Args())
	}
	return nil
}

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
	name, err := workspace.Resolve(snapshot, *issue, *issueTitle)
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

func validateRequirements(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-requirements")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	issue := flags.String("issue", "", "Issue identity")
	issueTitle := flags.String("issue-title", "", "cycle-start Issue title")
	issueURL := flags.String("issue-url", "", "Issue URL")
	issueUpdatedAt := flags.String("issue-updated-at", "", "Issue updatedAt")
	issueBodyPath := flags.String("issue-body", "", "Issue body file")
	documentPath := flags.String("document", "", "Requirements source")
	kind := flags.String("kind", "", "requirements or requirements_goal")
	goalPath := flags.String("goal-document", "", "retained Requirements Goal")
	ruleMapPath := flags.String("rule-map", handoff.RuleMapPath, "rule map")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *issue == "" || *issueTitle == "" || *issueURL == "" || *issueUpdatedAt == "" || *issueBodyPath == "" || *documentPath == "" || *kind == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-requirements", "cli", "validate-requirements requires repository, workspace, Issue snapshot, document, and kind arguments", nil, arguments)
	}
	issueBody, err := repository.ReadExternal(*issueBodyPath)
	if err != nil {
		return err
	}
	document, err := repository.ReadExternal(*documentPath)
	if err != nil {
		return err
	}
	var goal []byte
	if *goalPath != "" {
		goal, err = repository.ReadExternal(*goalPath)
		if err != nil {
			return err
		}
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	_, err = gates.ValidateRequirements(ctx, snapshot, gates.RequirementsInput{
		Issue:     gates.IssueSnapshot{ID: *issue, Title: *issueTitle, URL: *issueURL, UpdatedAt: *issueUpdatedAt, Body: issueBody},
		Workspace: *workspace, Kind: *kind, Document: document, Goal: goal, RuleMapPath: *ruleMapPath,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Requirements gate: verified: kind=%s workspace=%s\n", *kind, *workspace)
	return nil
}

func validateDesign(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-design")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	issue := flags.String("issue", "", "Issue identity")
	issueTitle := flags.String("issue-title", "", "cycle-start Issue title")
	issueURL := flags.String("issue-url", "", "Issue URL")
	issueUpdatedAt := flags.String("issue-updated-at", "", "Issue updatedAt")
	issueBodyPath := flags.String("issue-body", "", "Issue body file")
	requirementsPath := flags.String("requirements", "", "canonical Requirements source")
	documentPath := flags.String("document", "", "Design source")
	kind := flags.String("kind", "", "design or design_goal")
	goalPath := flags.String("goal-document", "", "retained Design Goal")
	ruleMapPath := flags.String("rule-map", handoff.RuleMapPath, "rule map")
	profilePath := flags.String("profile-catalog", catalog.DefaultPath, "verification profile catalog")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *issue == "" || *issueTitle == "" || *issueURL == "" || *issueUpdatedAt == "" || *issueBodyPath == "" || *requirementsPath == "" || *documentPath == "" || *kind == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-design", "cli", "validate-design requires repository, workspace, Issue snapshot, Requirements, document, and kind arguments", nil, arguments)
	}
	issueBody, err := repository.ReadExternal(*issueBodyPath)
	if err != nil {
		return err
	}
	requirements, err := repository.ReadExternal(*requirementsPath)
	if err != nil {
		return err
	}
	document, err := repository.ReadExternal(*documentPath)
	if err != nil {
		return err
	}
	var goal []byte
	if *goalPath != "" {
		goal, err = repository.ReadExternal(*goalPath)
		if err != nil {
			return err
		}
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	_, err = gates.ValidateDesign(ctx, snapshot, gates.DesignInput{
		Issue:     gates.IssueSnapshot{ID: *issue, Title: *issueTitle, URL: *issueURL, UpdatedAt: *issueUpdatedAt, Body: issueBody},
		Workspace: *workspace, Kind: *kind, Requirements: requirements, Document: document, Goal: goal,
		RuleMapPath: *ruleMapPath, ProfilePath: *profilePath,
	})
	if err != nil {
		return err
	}
	fmt.Printf("Design gate: verified: kind=%s workspace=%s\n", *kind, *workspace)
	return nil
}

func captureDesign(ctx context.Context, arguments []string) error {
	flags := newFlagSet("capture-design")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	issue := flags.String("issue", "", "Issue identity")
	issueURL := flags.String("issue-url", "", "Issue URL")
	issueUpdatedAt := flags.String("issue-updated-at", "", "Issue updatedAt")
	issueBodyPath := flags.String("issue-body", "", "Issue body file")
	goalPath := flags.String("goal-document", "", "retained Design Goal JSON")
	profilePath := flags.String("profile-catalog", catalog.DefaultPath, "verification profile catalog")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *issue == "" || *issueURL == "" || *issueUpdatedAt == "" || *issueBodyPath == "" || *goalPath == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "capture-design", "cli", "capture-design requires repository, workspace, Issue snapshot, and retained Goal arguments", nil, arguments)
	}
	issueBody, err := repository.ReadExternal(*issueBodyPath)
	if err != nil {
		return err
	}
	goal, err := repository.ReadExternal(*goalPath)
	if err != nil {
		return err
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	path, digest, err := handoff.Capture(ctx, snapshot, handoff.CaptureInput{IssueID: *issue, IssueURL: *issueURL, IssueUpdatedAt: *issueUpdatedAt, IssueBody: issueBody, DesignGoal: goal, Workspace: *workspace, ProfilePath: *profilePath})
	if err != nil {
		return err
	}
	fmt.Printf("Design completion: captured: %s sha256=%s\n", filepath.Join(snapshot.Root, filepath.FromSlash(path)), digest)
	return nil
}

func buildEntry(ctx context.Context, arguments []string) error {
	flags := newFlagSet("build-entry")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	issue := flags.String("issue", "", "Issue identity")
	issueURL := flags.String("issue-url", "", "Issue URL")
	issueUpdatedAt := flags.String("issue-updated-at", "", "Issue updatedAt")
	issueBodyPath := flags.String("issue-body", "", "Issue body file")
	expectedReceipt := flags.String("expected-receipt-sha256", "", "Design completion hash")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *issue == "" || *issueURL == "" || *issueUpdatedAt == "" || *issueBodyPath == "" || *expectedReceipt == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "build-entry", "cli", "build-entry requires repository, workspace, Issue snapshot, and expected receipt hash arguments", nil, arguments)
	}
	issueBody, err := repository.ReadExternal(*issueBodyPath)
	if err != nil {
		return err
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	loaded, err := handoff.Check(snapshot, handoff.CheckInput{IssueID: *issue, IssueURL: *issueURL, IssueUpdatedAt: *issueUpdatedAt, IssueBody: issueBody, Workspace: *workspace, ExpectedSHA256: *expectedReceipt})
	if err != nil {
		return err
	}
	path, err := receipt.Path(*workspace)
	if err != nil {
		return err
	}
	fmt.Printf("Build entry: verified: %s sha256=%s\n", filepath.Join(snapshot.Root, filepath.FromSlash(path)), loaded.SHA256)
	return nil
}

func captureVerification(ctx context.Context, arguments []string) error {
	flags := newFlagSet("capture-verification")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	expectedReceipt := flags.String("expected-receipt-sha256", "", "Design completion hash")
	var manualObservations repeatedFlag
	flags.Var(&manualObservations, "manual-observation", "VC-ID=text")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *expectedReceipt == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "capture-verification", "cli", "capture-verification requires repository, workspace, and expected receipt hash arguments", nil, arguments)
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	loaded, err := receipt.Load(snapshot, *workspace, *expectedReceipt)
	if err != nil {
		return err
	}
	observations, err := runner.ParseManualObservations(manualObservations)
	if err != nil {
		return err
	}
	value, err := runner.Execute(ctx, snapshot, loaded, runner.Options{ManualObservations: observations})
	if err != nil {
		return err
	}
	serialized, err := canonical.Pretty(value)
	if err != nil {
		return err
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return err
	}
	path, err := evidencePath(*workspace)
	if err != nil {
		return err
	}
	if err := snapshot.WriteAtomic(path, serialized); err != nil {
		return err
	}
	fmt.Printf("Build verification: captured: %s\n", filepath.Join(snapshot.Root, filepath.FromSlash(path)))
	return nil
}

func validateBuild(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-build")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	expectedReceipt := flags.String("expected-receipt-sha256", "", "Design completion hash")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *expectedReceipt == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-build", "cli", "validate-build requires repository, workspace, and expected receipt hash arguments", nil, arguments)
	}
	snapshot, err := repository.Open(ctx, *repoRoot)
	if err != nil {
		return err
	}
	defer snapshot.Close()
	loaded, err := receipt.Load(snapshot, *workspace, *expectedReceipt)
	if err != nil {
		return err
	}
	record, err := coverage.ValidateAndBuild(ctx, snapshot, loaded)
	if err != nil {
		return err
	}
	serialized, err := canonical.Pretty(record)
	if err != nil {
		return err
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return err
	}
	path, err := coverage.Path(*workspace)
	if err != nil {
		return err
	}
	if err := snapshot.WriteAtomic(path, serialized); err != nil {
		return err
	}
	fmt.Printf("Build coverage: verified: %s changed_paths=%d\n", filepath.Join(snapshot.Root, filepath.FromSlash(path)), len(record.ChangedPaths))
	return nil
}

func evidencePath(workspace string) (string, error) {
	return repository.WorkspacePath(workspace, ".aidd/build-verification.json")
}

type repeatedFlag []string

func (values *repeatedFlag) String() string {
	copyValues := append([]string(nil), *values...)
	sort.Strings(copyValues)
	return strings.Join(copyValues, ",")
}

func (values *repeatedFlag) Set(value string) error {
	*values = append(*values, value)
	return nil
}

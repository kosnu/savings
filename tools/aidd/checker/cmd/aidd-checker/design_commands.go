package main

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/gates"
	"github.com/kosnu/savings/tools/aidd/checker/internal/handoff"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func validateDesign(ctx context.Context, arguments []string) error {
	flags := newFlagSet("validate-design")
	repoRoot := flags.String("repo-root", "", "repository root")
	workspace := flags.String("workspace", "", "workspace")
	issue := flags.String("issue", "", "Issue identity")
	issueURL := flags.String("issue-url", "", "Issue URL")
	issueUpdatedAt := flags.String("issue-updated-at", "", "Issue updatedAt")
	issueBodyPath := flags.String("issue-body", "", "Issue body file")
	requirementsPath := flags.String("requirements", "", "canonical Requirements source")
	documentPath := flags.String("document", "", "Design source")
	kind := flags.String("kind", "", "design or design_goal")
	goalPath := flags.String("goal-document", "", "retained Design Goal")
	ruleMapPath := flags.String("rule-map", handoff.RuleMapPath, "canonical rule map")
	profilePath := flags.String("profile-catalog", catalog.DefaultPath, "verification profile catalog")
	if err := parseFlags(flags, arguments); err != nil {
		return err
	}
	if *repoRoot == "" || *workspace == "" || *issue == "" || *issueURL == "" || *issueUpdatedAt == "" || *issueBodyPath == "" || *requirementsPath == "" || *documentPath == "" || *kind == "" {
		return diagnostic.New("AIDD_CLI_ARGUMENT", "validate-design", "cli", "validate-design requires repository, workspace, Issue snapshot, Requirements, document, and kind arguments", nil, arguments)
	}
	issueBody, err := repository.ReadExternal(*issueBodyPath)
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
	requirements, err := readCanonicalWorkspaceSource(snapshot, *workspace, "requirements.json", *requirementsPath, "--requirements")
	if err != nil {
		return err
	}
	var document []byte
	if *kind == "design" {
		document, err = readCanonicalWorkspaceSource(snapshot, *workspace, "design-doc.json", *documentPath, "--document")
	} else {
		document, err = repository.ReadExternal(*documentPath)
	}
	if err != nil {
		return err
	}
	_, err = gates.ValidateDesign(ctx, snapshot, gates.DesignInput{
		Issue:     gates.IssueSnapshot{ID: *issue, URL: *issueURL, UpdatedAt: *issueUpdatedAt, Body: issueBody},
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

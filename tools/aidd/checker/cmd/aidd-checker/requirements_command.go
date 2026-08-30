package main

import (
	"context"
	"fmt"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/gates"
	"github.com/kosnu/savings/tools/aidd/checker/internal/handoff"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

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
	ruleMapPath := flags.String("rule-map", handoff.RuleMapPath, "canonical rule map")
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
	var document []byte
	if *kind == "requirements" {
		document, err = readCanonicalWorkspaceSource(snapshot, *workspace, "requirements.json", *documentPath, "--document")
	} else {
		document, err = repository.ReadExternal(*documentPath)
	}
	if err != nil {
		return err
	}
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

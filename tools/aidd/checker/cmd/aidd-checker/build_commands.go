package main

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/coverage"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
)

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

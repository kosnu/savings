package runner

import (
	"context"
	"sort"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/manualcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
	"github.com/kosnu/savings/tools/aidd/checker/internal/verificationcontract"
)

const Generator = "aidd-checker/v4"

type Options struct {
	ManualObservations map[string]string
}

func Execute(ctx context.Context, snapshot *repository.Snapshot, loaded *receipt.Loaded, options Options) (*model.BuildEvidence, error) {
	return ExecuteContract(ctx, snapshot, verificationcontract.Input{SchemaVersion: 4, Generator: Generator, Workspace: loaded.Value.Workspace, CheckpointSHA256: loaded.SHA256, BaselineHead: loaded.Value.BuildBaseline.Head, Target: loaded.Value.TargetState.Value, Catalog: loaded.Catalog}, options)
}

func ExecuteContract(ctx context.Context, snapshot *repository.Snapshot, input verificationcontract.Input, options Options) (*model.BuildEvidence, error) {
	if err := receipt.AssertBuildGitState(ctx, snapshot, input.BaselineHead); err != nil {
		return nil, err
	}
	target := &input.Target
	initialFinalState, err := state.FinalHash(snapshot, target)
	if err != nil {
		return nil, err
	}
	var initialRepositoryManifest *repository.MutationManifest
	initialGitState := ""
	for _, verificationCase := range target.VerificationCases {
		if verificationCase.Type != "automated" {
			continue
		}
		initialRepositoryManifest, err = snapshot.MutationManifest(ctx)
		if err != nil {
			return nil, err
		}
		initialGitState, err = state.RepositoryGitStateHash(ctx, snapshot)
		if err != nil {
			return nil, err
		}
		break
	}
	evidence := &model.BuildEvidence{
		SchemaVersion:    input.SchemaVersion,
		Kind:             "build_verification",
		Workspace:        input.Workspace,
		ReceiptSHA256:    input.CheckpointSHA256,
		CatalogSHA256:    input.Catalog.SHA256,
		FinalStateSHA256: initialFinalState,
		Generator:        input.Generator,
	}
	usedManual := map[string]struct{}{}
	for _, verificationCase := range target.VerificationCases {
		if verificationCase.Type == "manual" {
			observation, ok := options.ManualObservations[verificationCase.ID]
			if !ok || !manualcontract.ValidObservation(observation) {
				return nil, diagnostic.New("AIDD_MANUAL_OBSERVATION", verificationCase.ID, "build_verification", "manual verification case requires one substantive single-line observation", map[string]any{"minimum_substantive_runes": manualcontract.MinimumSubstantiveRunes, "single_line": true}, observation)
			}
			usedManual[verificationCase.ID] = struct{}{}
			evidence.Results = append(evidence.Results, model.VerificationResult{
				ID: verificationCase.ID, Type: "manual", Status: "passed",
				FinalStateSHA256: initialFinalState,
				Procedure:        verificationCase.Procedure, Observation: observation,
			})
			continue
		}
		profile := input.Catalog.Profiles[verificationCase.VerificationProfileID]
		profileHash := input.Catalog.ProfileHash[profile.ID]
		result, err := executeAutomated(ctx, snapshot, profile, profileHash, verificationCase, initialFinalState)
		if err != nil {
			return nil, err
		}
		evidence.Results = append(evidence.Results, *result)
		currentRepositoryManifest, err := snapshot.MutationManifest(ctx)
		if err != nil {
			return nil, err
		}
		if difference := repository.CompareMutationManifests(initialRepositoryManifest, currentRepositoryManifest); difference != nil {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", difference.Path, "build_verification", "verification case modified repository state, in Git-tracked or non-ignored paths", difference.Expected, difference.Actual)
		}
		if err := snapshot.AssertUnchanged(); err != nil {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", verificationCase.ID, "build_verification", "verification case modified a repository input", "unchanged snapshot", err.Error())
		}
		currentGitState, err := state.RepositoryGitStateHash(ctx, snapshot)
		if err != nil {
			return nil, err
		}
		if currentGitState != initialGitState {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", verificationCase.ID, "build_verification", "verification case modified repository HEAD or staged tree", initialGitState, currentGitState)
		}
		currentFinalState, err := state.FinalHash(snapshot, target)
		if err != nil {
			return nil, err
		}
		if currentFinalState != initialFinalState {
			return nil, diagnostic.New("AIDD_VERIFICATION_MUTATION", verificationCase.ID, "build_verification", "verification case modified the task-owned final state", initialFinalState, currentFinalState)
		}
	}
	manualIDs := make([]string, 0, len(options.ManualObservations))
	for id := range options.ManualObservations {
		manualIDs = append(manualIDs, id)
	}
	sort.Strings(manualIDs)
	for _, id := range manualIDs {
		if _, ok := usedManual[id]; !ok {
			return nil, diagnostic.New("AIDD_MANUAL_OBSERVATION_EXTRA", id, "build_verification", "manual observation names an unknown or automated case", nil, id)
		}
	}
	if err := receipt.AssertBuildGitState(ctx, snapshot, input.BaselineHead); err != nil {
		return nil, err
	}
	return evidence, nil
}

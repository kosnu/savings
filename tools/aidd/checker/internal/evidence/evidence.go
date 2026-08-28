package evidence

import (
	"fmt"
	"regexp"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func Path(workspace string) (string, error) {
	return repository.WorkspacePath(workspace, ".aidd/build-verification.json")
}

func LoadAndValidate(snapshot *repository.Snapshot, loadedReceipt *receipt.Loaded) (*model.BuildEvidence, []byte, error) {
	path, err := Path(loadedReceipt.Value.Workspace)
	if err != nil {
		return nil, nil, err
	}
	content, err := snapshot.Read(path)
	if err != nil {
		return nil, nil, err
	}
	var value model.BuildEvidence
	if err := canonical.Decode(content, "build_verification", &value); err != nil {
		return nil, nil, err
	}
	currentFinalState, err := state.FinalHash(snapshot, &loadedReceipt.Value.TargetState.Value)
	if err != nil {
		return nil, nil, err
	}
	if err := validateValue(&value, loadedReceipt, currentFinalState); err != nil {
		return nil, nil, err
	}
	return &value, content, nil
}

func validateValue(value *model.BuildEvidence, loadedReceipt *receipt.Loaded, currentFinalState string) error {
	if value.SchemaVersion != model.EvidenceSchemaVersion || value.Kind != "build_verification" || value.Workspace != loadedReceipt.Value.Workspace || value.ReceiptSHA256 != loadedReceipt.SHA256 || value.CatalogSHA256 != loadedReceipt.Catalog.SHA256 || value.FinalStateSHA256 != currentFinalState || value.Generator != runner.Generator {
		return diagnostic.New("AIDD_EVIDENCE_IDENTITY", "", "build_verification", "Build evidence identity does not match the current receipt, catalog, and final state", map[string]any{"schema_version": model.EvidenceSchemaVersion, "workspace": loadedReceipt.Value.Workspace, "receipt_sha256": loadedReceipt.SHA256, "catalog_sha256": loadedReceipt.Catalog.SHA256, "final_state_sha256": currentFinalState, "generator": runner.Generator}, value)
	}
	cases := loadedReceipt.Value.TargetState.Value.VerificationCases
	if len(value.Results) != len(cases) {
		return diagnostic.New("AIDD_EVIDENCE_INVENTORY", "results", "build_verification", "Build evidence must contain exactly one result per verification case", len(cases), len(value.Results))
	}
	seen := map[string]struct{}{}
	for index, verificationCase := range cases {
		result := value.Results[index]
		if _, duplicate := seen[result.ID]; duplicate || result.ID != verificationCase.ID || result.Type != verificationCase.Type || result.Status != "passed" || result.FinalStateSHA256 != currentFinalState {
			return diagnostic.New("AIDD_EVIDENCE_RESULT", fmt.Sprintf("results[%d]", index), "build_verification", "verification result identity, order, status, or final-state hash is invalid", verificationCase, result)
		}
		seen[result.ID] = struct{}{}
		if verificationCase.Type == "manual" {
			if result.Procedure != verificationCase.Procedure || result.Observation == "" || result.VerificationProfileID != "" || result.Selector != nil {
				return diagnostic.New("AIDD_EVIDENCE_MANUAL", fmt.Sprintf("results[%d]", index), "build_verification", "manual verification evidence does not match the target case", verificationCase, result)
			}
			continue
		}
		profileHash := loadedReceipt.Catalog.ProfileHash[verificationCase.VerificationProfileID]
		if result.VerificationProfileID != verificationCase.VerificationProfileID || result.ProfileSHA256 != profileHash || !equalJSON(result.Selector, verificationCase.Selector) || result.ExitCode == nil || *result.ExitCode != 0 || result.StdoutBytes == nil || *result.StdoutBytes < 0 || result.StderrBytes == nil || *result.StderrBytes < 0 || !digestPattern.MatchString(result.OutputSHA256) {
			return diagnostic.New("AIDD_EVIDENCE_AUTOMATED", fmt.Sprintf("results[%d]", index), "build_verification", "automated verification evidence does not match the profile-fixed target case", verificationCase, result)
		}
		expectedIdentity := model.RuntimeIdentity{Kind: verificationCase.Selector.Kind}
		if verificationCase.Selector.Kind == "suite" {
			expectedIdentity.ID = verificationCase.VerificationProfileID
		} else {
			expectedIdentity.Path = verificationCase.Selector.Path
			expectedIdentity.Name = verificationCase.Selector.Name
		}
		if len(result.ExecutedIdentities) != 1 || result.ExecutedIdentities[0] != expectedIdentity {
			return diagnostic.New("AIDD_EVIDENCE_RUNTIME_IDENTITY", fmt.Sprintf("results[%d].executed_identities", index), "build_verification", "runtime identity does not match the typed selector", []model.RuntimeIdentity{expectedIdentity}, result.ExecutedIdentities)
		}
	}
	return nil
}

func equalJSON(left, right any) bool {
	leftBytes, leftErr := canonical.Marshal(left)
	rightBytes, rightErr := canonical.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftBytes) == string(rightBytes)
}

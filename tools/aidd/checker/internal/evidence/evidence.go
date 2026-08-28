package evidence

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/manualcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type buildEvidenceWire struct {
	SchemaVersion    int               `json:"schema_version"`
	Kind             string            `json:"kind"`
	Workspace        string            `json:"workspace"`
	ReceiptSHA256    string            `json:"receipt_sha256"`
	CatalogSHA256    string            `json:"catalog_sha256"`
	FinalStateSHA256 string            `json:"final_state_sha256"`
	Generator        string            `json:"generator"`
	Results          []json.RawMessage `json:"results"`
}

type manualResultWire struct {
	ID               string `json:"id"`
	Type             string `json:"type"`
	Status           string `json:"status"`
	FinalStateSHA256 string `json:"final_state_sha256"`
	Procedure        string `json:"procedure"`
	Observation      string `json:"observation"`
}

type automatedResultWire struct {
	ID                    string                  `json:"id"`
	Type                  string                  `json:"type"`
	Status                string                  `json:"status"`
	VerificationProfileID string                  `json:"verification_profile_id"`
	ProfileSHA256         string                  `json:"profile_sha256"`
	Selector              *model.Selector         `json:"selector"`
	ExecutedIdentities    []model.RuntimeIdentity `json:"executed_identities"`
	ExitCode              *int                    `json:"exit_code"`
	StdoutBytes           *int                    `json:"stdout_bytes"`
	StderrBytes           *int                    `json:"stderr_bytes"`
	OutputSHA256          string                  `json:"output_sha256"`
	FinalStateSHA256      string                  `json:"final_state_sha256"`
}

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
	value, err := decodeValue(content)
	if err != nil {
		return nil, nil, err
	}
	currentFinalState, err := state.FinalHash(snapshot, &loadedReceipt.Value.TargetState.Value)
	if err != nil {
		return nil, nil, err
	}
	if err := validateValue(value, loadedReceipt, currentFinalState); err != nil {
		return nil, nil, err
	}
	return value, content, nil
}

func decodeValue(content []byte) (*model.BuildEvidence, error) {
	var wire buildEvidenceWire
	if err := canonical.Decode(content, "build_verification", &wire); err != nil {
		return nil, err
	}
	value := &model.BuildEvidence{
		SchemaVersion: wire.SchemaVersion, Kind: wire.Kind, Workspace: wire.Workspace,
		ReceiptSHA256: wire.ReceiptSHA256, CatalogSHA256: wire.CatalogSHA256,
		FinalStateSHA256: wire.FinalStateSHA256, Generator: wire.Generator,
		Results: make([]model.VerificationResult, 0, len(wire.Results)),
	}
	for index, raw := range wire.Results {
		result, err := decodeResult(raw, index)
		if err != nil {
			return nil, err
		}
		value.Results = append(value.Results, result)
	}
	return value, nil
}

func decodeResult(raw json.RawMessage, index int) (model.VerificationResult, error) {
	var discriminator struct {
		Type string `json:"type"`
	}
	path := fmt.Sprintf("results[%d]", index)
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return model.VerificationResult{}, diagnostic.New("AIDD_EVIDENCE_RESULT_SHAPE", path, "build_verification", "verification result type discriminator is invalid", []string{"automated", "manual"}, err.Error())
	}
	artifact := fmt.Sprintf("build_verification.%s", path)
	switch discriminator.Type {
	case "manual":
		var wire manualResultWire
		if err := canonical.Decode(raw, artifact, &wire); err != nil {
			return model.VerificationResult{}, err
		}
		return model.VerificationResult{
			ID: wire.ID, Type: wire.Type, Status: wire.Status,
			FinalStateSHA256: wire.FinalStateSHA256,
			Procedure:        wire.Procedure, Observation: wire.Observation,
		}, nil
	case "automated":
		var wire automatedResultWire
		if err := canonical.Decode(raw, artifact, &wire); err != nil {
			return model.VerificationResult{}, err
		}
		return model.VerificationResult{
			ID: wire.ID, Type: wire.Type, Status: wire.Status,
			VerificationProfileID: wire.VerificationProfileID, ProfileSHA256: wire.ProfileSHA256,
			Selector: wire.Selector, ExecutedIdentities: wire.ExecutedIdentities,
			ExitCode: wire.ExitCode, StdoutBytes: wire.StdoutBytes, StderrBytes: wire.StderrBytes,
			OutputSHA256: wire.OutputSHA256, FinalStateSHA256: wire.FinalStateSHA256,
		}, nil
	default:
		return model.VerificationResult{}, diagnostic.New("AIDD_EVIDENCE_RESULT_SHAPE", path+".type", "build_verification", "verification result type is unsupported", []string{"automated", "manual"}, discriminator.Type)
	}
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
			if result.Procedure != verificationCase.Procedure || !manualcontract.ValidObservation(result.Observation) || hasAutomatedFields(result) {
				return diagnostic.New("AIDD_EVIDENCE_MANUAL", fmt.Sprintf("results[%d]", index), "build_verification", "manual verification evidence does not match the target case", verificationCase, result)
			}
			continue
		}
		profileHash := loadedReceipt.Catalog.ProfileHash[verificationCase.VerificationProfileID]
		if hasManualFields(result) || result.VerificationProfileID != verificationCase.VerificationProfileID || result.ProfileSHA256 != profileHash || !equalJSON(result.Selector, verificationCase.Selector) || result.ExitCode == nil || *result.ExitCode != 0 || result.StdoutBytes == nil || *result.StdoutBytes < 0 || result.StderrBytes == nil || *result.StderrBytes < 0 || !digestPattern.MatchString(result.OutputSHA256) {
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

func hasAutomatedFields(result model.VerificationResult) bool {
	return result.VerificationProfileID != "" || result.ProfileSHA256 != "" || result.Selector != nil || len(result.ExecutedIdentities) != 0 || result.ExitCode != nil || result.StdoutBytes != nil || result.StderrBytes != nil || result.OutputSHA256 != ""
}

func hasManualFields(result model.VerificationResult) bool {
	return result.Procedure != "" || result.Observation != ""
}

func equalJSON(left, right any) bool {
	leftBytes, leftErr := canonical.Marshal(left)
	rightBytes, rightErr := canonical.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftBytes) == string(rightBytes)
}

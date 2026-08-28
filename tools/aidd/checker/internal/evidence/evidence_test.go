package evidence

import (
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
)

const evidenceHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func evidenceFixture() (*model.BuildEvidence, *receipt.Loaded) {
	exitCode := 0
	stdoutBytes := 10
	stderrBytes := 0
	selector := &model.Selector{Kind: "suite"}
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "automated", RequirementID: "FR-1", VerificationProfileID: "suite-profile", Selector: selector}
	loaded := &receipt.Loaded{
		SHA256:  evidenceHash,
		Value:   model.Receipt{Workspace: "1671-checker", TargetState: model.HashValue[model.TargetState]{Value: model.TargetState{VerificationCases: []model.VerificationCase{verificationCase}}}},
		Catalog: &catalog.Resolved{SHA256: evidenceHash, ProfileHash: map[string]string{"suite-profile": evidenceHash}},
	}
	value := &model.BuildEvidence{
		SchemaVersion: model.EvidenceSchemaVersion, Kind: "build_verification", Workspace: "1671-checker",
		ReceiptSHA256: evidenceHash, CatalogSHA256: evidenceHash, FinalStateSHA256: evidenceHash, Generator: runner.Generator,
		Results: []model.VerificationResult{{
			ID: "VC-1", Type: "automated", Status: "passed", VerificationProfileID: "suite-profile", ProfileSHA256: evidenceHash,
			Selector: selector, ExecutedIdentities: []model.RuntimeIdentity{{Kind: "suite", ID: "suite-profile"}}, ExitCode: &exitCode,
			StdoutBytes: &stdoutBytes, StderrBytes: &stderrBytes, OutputSHA256: evidenceHash, FinalStateSHA256: evidenceHash,
		}},
	}
	return value, loaded
}

func TestEvidenceRejectsMissingAndExtraResults(t *testing.T) {
	for _, count := range []int{0, 2} {
		value, loaded := evidenceFixture()
		if count == 0 {
			value.Results = nil
		} else {
			value.Results = append(value.Results, value.Results[0])
		}
		err := validateValue(value, loaded, evidenceHash)
		if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_INVENTORY") {
			t.Fatalf("result count %d: expected inventory diagnostic, got %v", count, err)
		}
	}
}

func TestEvidenceRejectsProfileDrift(t *testing.T) {
	value, loaded := evidenceFixture()
	value.Results[0].ProfileSHA256 = strings.Repeat("b", 64)
	err := validateValue(value, loaded, evidenceHash)
	if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_AUTOMATED") {
		t.Fatalf("expected profile diagnostic, got %v", err)
	}
}

func TestEvidenceRejectsDuplicateResultID(t *testing.T) {
	value, loaded := evidenceFixture()
	loaded.Value.TargetState.Value.VerificationCases = append(
		loaded.Value.TargetState.Value.VerificationCases,
		model.VerificationCase{ID: "VC-2", Type: "manual", RequirementID: "AC-1", Procedure: "画面表示が崩れていないことを確認する"},
	)
	value.Results = append(value.Results, value.Results[0])
	err := validateValue(value, loaded, evidenceHash)
	if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_RESULT") {
		t.Fatalf("expected duplicate result diagnostic, got %v", err)
	}
}

func TestEvidenceRejectsNonSubstantiveManualObservation(t *testing.T) {
	procedure := "画面表示が崩れていないことを確認する"
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "manual", RequirementID: "AC-1", Procedure: procedure}
	loaded := &receipt.Loaded{
		SHA256: evidenceHash,
		Value: model.Receipt{
			Workspace:   "1671-checker",
			TargetState: model.HashValue[model.TargetState]{Value: model.TargetState{VerificationCases: []model.VerificationCase{verificationCase}}},
		},
		Catalog: &catalog.Resolved{SHA256: evidenceHash},
	}
	value := &model.BuildEvidence{
		SchemaVersion: model.EvidenceSchemaVersion, Kind: "build_verification", Workspace: "1671-checker",
		ReceiptSHA256: evidenceHash, CatalogSHA256: evidenceHash, FinalStateSHA256: evidenceHash, Generator: runner.Generator,
		Results: []model.VerificationResult{{
			ID: "VC-1", Type: "manual", Status: "passed", FinalStateSHA256: evidenceHash,
			Procedure: procedure, Observation: "画面表示が崩れていないことを確認した",
		}},
	}
	if err := validateValue(value, loaded, evidenceHash); err != nil {
		t.Fatalf("valid manual evidence rejected: %v", err)
	}
	for name, observation := range map[string]string{
		"single character": "x",
		"punctuation only": "...（！）...",
		"multiline":        "画面表示が崩れていないことを\n確認した",
	} {
		t.Run(name, func(t *testing.T) {
			value.Results[0].Observation = observation
			err := validateValue(value, loaded, evidenceHash)
			if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_MANUAL") {
				t.Fatalf("expected manual evidence diagnostic, got %v", err)
			}
		})
	}
}

func TestEvidenceRejectsLegacyCommandField(t *testing.T) {
	var value model.BuildEvidence
	err := canonical.Decode([]byte(`{"schema_version":4,"kind":"build_verification","workspace":"w","receipt_sha256":"a","catalog_sha256":"a","final_state_sha256":"a","generator":"aidd-checker/v4","results":[{"id":"VC-1","type":"automated","status":"passed","command":["python3"]}]}`), "fixture", &value)
	if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected legacy command rejection, got %v", err)
	}
}

func TestEvidenceCanonicalGolden(t *testing.T) {
	value, _ := evidenceFixture()
	digest, err := canonical.Hash(value)
	if err != nil {
		t.Fatal(err)
	}
	const expected = "1ee4624ba664ae86183e1c5b72cf294bed19c3d7ff0576c359a5b2d149736b29"
	if digest != expected {
		t.Fatalf("evidence canonical golden = %s, want %s", digest, expected)
	}
}

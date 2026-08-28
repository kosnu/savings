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

func manualEvidenceFixture() (*model.BuildEvidence, *receipt.Loaded) {
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
	return value, loaded
}

func evidenceWireJSON(t *testing.T, results ...map[string]any) []byte {
	t.Helper()
	entries := make([]any, len(results))
	for index, result := range results {
		entries[index] = result
	}
	content, err := canonical.Pretty(map[string]any{
		"schema_version":     model.EvidenceSchemaVersion,
		"kind":               "build_verification",
		"workspace":          "1671-checker",
		"receipt_sha256":     evidenceHash,
		"catalog_sha256":     evidenceHash,
		"final_state_sha256": evidenceHash,
		"generator":          runner.Generator,
		"results":            entries,
	})
	if err != nil {
		t.Fatal(err)
	}
	return content
}

func manualResultJSON() map[string]any {
	return map[string]any{
		"id": "VC-1", "type": "manual", "status": "passed",
		"final_state_sha256": evidenceHash,
		"procedure":          "画面表示が崩れていないことを確認する",
		"observation":        "画面表示が崩れていないことを確認した",
	}
}

func automatedResultJSON() map[string]any {
	return map[string]any{
		"id": "VC-2", "type": "automated", "status": "passed",
		"verification_profile_id": "suite-profile", "profile_sha256": evidenceHash,
		"selector":            map[string]any{"kind": "suite"},
		"executed_identities": []any{map[string]any{"kind": "suite", "id": "suite-profile"}},
		"exit_code":           0, "stdout_bytes": 10, "stderr_bytes": 0,
		"output_sha256": evidenceHash, "final_state_sha256": evidenceHash,
	}
}

func cloneResult(result map[string]any) map[string]any {
	clone := make(map[string]any, len(result)+1)
	for key, value := range result {
		clone[key] = value
	}
	return clone
}

func TestEvidenceDecodeAcceptsCaseTypeSpecificResults(t *testing.T) {
	automated, _ := evidenceFixture()
	manual, _ := manualEvidenceFixture()
	for _, test := range []struct {
		name  string
		value *model.BuildEvidence
	}{
		{name: "automated", value: automated},
		{name: "manual", value: manual},
	} {
		t.Run(test.name, func(t *testing.T) {
			content, err := canonical.Pretty(test.value)
			if err != nil {
				t.Fatal(err)
			}
			value, err := decodeValue(content)
			if err != nil {
				t.Fatalf("valid case-specific evidence rejected: %v", err)
			}
			if len(value.Results) != 1 || value.Results[0].Type != test.name {
				t.Fatalf("unexpected decoded results: %#v", value.Results)
			}
		})
	}
}

func TestEvidenceDecodeRejectsCrossTypeFieldsIncludingZeroValues(t *testing.T) {
	tests := []struct {
		name   string
		result map[string]any
		field  string
		value  any
	}{
		{name: "manual profile id", result: manualResultJSON(), field: "verification_profile_id", value: "suite-profile"},
		{name: "manual profile hash", result: manualResultJSON(), field: "profile_sha256", value: evidenceHash},
		{name: "manual selector", result: manualResultJSON(), field: "selector", value: map[string]any{"kind": "suite"}},
		{name: "manual identities", result: manualResultJSON(), field: "executed_identities", value: []any{map[string]any{"kind": "suite", "id": "suite-profile"}}},
		{name: "manual exit code", result: manualResultJSON(), field: "exit_code", value: 0},
		{name: "manual stdout", result: manualResultJSON(), field: "stdout_bytes", value: 0},
		{name: "manual stderr", result: manualResultJSON(), field: "stderr_bytes", value: 0},
		{name: "manual output hash", result: manualResultJSON(), field: "output_sha256", value: evidenceHash},
		{name: "manual empty profile hash", result: manualResultJSON(), field: "profile_sha256", value: ""},
		{name: "manual empty identities", result: manualResultJSON(), field: "executed_identities", value: []any{}},
		{name: "manual null exit code", result: manualResultJSON(), field: "exit_code", value: nil},
		{name: "automated procedure", result: automatedResultJSON(), field: "procedure", value: "画面表示を確認する"},
		{name: "automated observation", result: automatedResultJSON(), field: "observation", value: "画面表示を確認した"},
		{name: "automated empty procedure", result: automatedResultJSON(), field: "procedure", value: ""},
		{name: "automated null observation", result: automatedResultJSON(), field: "observation", value: nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := cloneResult(test.result)
			result[test.field] = test.value
			_, err := decodeValue(evidenceWireJSON(t, result))
			if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected case-specific shape diagnostic, got %v", err)
			}
		})
	}
}

func TestEvidenceDecodeRejectsCrossVariantSelectorAndIdentityFields(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "suite selector path", mutate: func(result map[string]any) {
			result["selector"].(map[string]any)["path"] = ""
		}},
		{name: "suite selector name", mutate: func(result map[string]any) {
			result["selector"].(map[string]any)["name"] = ""
		}},
		{name: "suite identity path", mutate: func(result map[string]any) {
			result["executed_identities"].([]any)[0].(map[string]any)["path"] = ""
		}},
		{name: "suite identity name", mutate: func(result map[string]any) {
			result["executed_identities"].([]any)[0].(map[string]any)["name"] = ""
		}},
		{name: "test-case identity id", mutate: func(result map[string]any) {
			result["selector"] = map[string]any{"kind": "test_case", "path": "tools/example_test.go", "name": "TestExample"}
			result["executed_identities"] = []any{map[string]any{
				"kind": "test_case", "path": "tools/example_test.go", "name": "TestExample", "id": "",
			}}
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := automatedResultJSON()
			test.mutate(result)
			_, err := decodeValue(evidenceWireJSON(t, result))
			if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected strict selector or identity shape rejection, got %v", err)
			}
		})
	}
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
	value, loaded := manualEvidenceFixture()
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

func TestEvidenceRejectsAutomatedFieldsOnManualResult(t *testing.T) {
	exitCode := 0
	stdoutBytes := 0
	stderrBytes := 0
	mutations := []struct {
		name   string
		mutate func(*model.VerificationResult)
	}{
		{name: "profile id", mutate: func(result *model.VerificationResult) { result.VerificationProfileID = "suite-profile" }},
		{name: "profile hash", mutate: func(result *model.VerificationResult) { result.ProfileSHA256 = evidenceHash }},
		{name: "selector", mutate: func(result *model.VerificationResult) { result.Selector = &model.Selector{Kind: "suite"} }},
		{name: "identities", mutate: func(result *model.VerificationResult) {
			result.ExecutedIdentities = []model.RuntimeIdentity{{Kind: "suite", ID: "suite-profile"}}
		}},
		{name: "exit code", mutate: func(result *model.VerificationResult) { result.ExitCode = &exitCode }},
		{name: "stdout", mutate: func(result *model.VerificationResult) { result.StdoutBytes = &stdoutBytes }},
		{name: "stderr", mutate: func(result *model.VerificationResult) { result.StderrBytes = &stderrBytes }},
		{name: "output hash", mutate: func(result *model.VerificationResult) { result.OutputSHA256 = evidenceHash }},
	}
	for _, mutation := range mutations {
		t.Run(mutation.name, func(t *testing.T) {
			value, loaded := manualEvidenceFixture()
			mutation.mutate(&value.Results[0])
			err := validateValue(value, loaded, evidenceHash)
			if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_MANUAL") {
				t.Fatalf("expected manual evidence diagnostic, got %v", err)
			}
		})
	}
}

func TestEvidenceRejectsManualFieldsOnAutomatedResult(t *testing.T) {
	for _, mutation := range []struct {
		name   string
		mutate func(*model.VerificationResult)
	}{
		{name: "procedure", mutate: func(result *model.VerificationResult) { result.Procedure = "画面表示を確認する" }},
		{name: "observation", mutate: func(result *model.VerificationResult) { result.Observation = "画面表示を確認した" }},
	} {
		t.Run(mutation.name, func(t *testing.T) {
			value, loaded := evidenceFixture()
			mutation.mutate(&value.Results[0])
			err := validateValue(value, loaded, evidenceHash)
			if err == nil || !strings.Contains(err.Error(), "AIDD_EVIDENCE_AUTOMATED") {
				t.Fatalf("expected automated evidence diagnostic, got %v", err)
			}
		})
	}
}

func TestEvidenceRejectsLegacyCommandField(t *testing.T) {
	_, err := decodeValue([]byte(`{"schema_version":4,"kind":"build_verification","workspace":"w","receipt_sha256":"a","catalog_sha256":"a","final_state_sha256":"a","generator":"aidd-checker/v4","results":[{"id":"VC-1","type":"automated","status":"passed","command":["python3"]}]}`))
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

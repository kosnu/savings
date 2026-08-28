package semantic

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

func validTarget() model.TargetState {
	return model.TargetState{
		ProductBehaviors: []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "profile固定後の最終状態になる", RequirementID: "FR-1"}},
		VerificationCases: []model.VerificationCase{
			{ID: "VC-1", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationProfileID: "git-diff-check", Selector: &model.Selector{Kind: "suite"}},
			{ID: "VC-2", Type: "manual", RequirementID: "AC-1", ProductBehaviorIDs: []string{}, Procedure: "構造化診断を画面上で確認する"},
		},
		OwnershipScopes: []model.OwnershipScope{{Path: "tool.go", Kind: "file"}, {Path: "tool_test.go", Kind: "file"}},
		Representations: []model.Representation{
			{ID: "REP-1", Kind: "implementation", Path: "tool.go", Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{}},
			{ID: "REP-2", Kind: "test", Path: "tool_test.go", Locator: model.Locator{Kind: "test_case", Name: "profile evidence"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{}, VerificationCaseIDs: []string{"VC-1"}},
			{ID: "REP-3", Kind: "test", Path: "tool_test.go", Locator: model.Locator{Kind: "test_case", Name: "manual evidence"}, RequirementID: "AC-1", ProductBehaviorIDs: []string{}, VerificationCaseIDs: []string{"VC-2"}},
		},
	}
}

func TestValidateTargetStateAcceptsProfileSelectors(t *testing.T) {
	target := validTarget()
	if err := ValidateTargetState(&target, []string{"FR-1", "AC-1"}, "fixture"); err != nil {
		t.Fatal(err)
	}
}

func TestValidateTargetStateRejectsMissingProfile(t *testing.T) {
	target := validTarget()
	target.VerificationCases[0].VerificationProfileID = ""
	err := ValidateTargetState(&target, []string{"FR-1", "AC-1"}, "fixture")
	if err == nil || !strings.Contains(err.Error(), "AIDD_AUTOMATED_CASE_SHAPE") {
		t.Fatalf("expected automated-case diagnostic, got %v", err)
	}
}

func TestParseSourceRejectsLegacyCommandInV4(t *testing.T) {
	target := validTarget()
	targetBytes, err := json.Marshal(target)
	if err != nil {
		t.Fatal(err)
	}
	var targetMap map[string]any
	if err := json.Unmarshal(targetBytes, &targetMap); err != nil {
		t.Fatal(err)
	}
	cases := targetMap["verification_cases"].([]any)
	first := cases[0].(map[string]any)
	first["command"] = []any{"python3", "-c", "raise SystemExit(0)"}
	source := map[string]any{
		"schema_version": 4,
		"kind":           "design",
		"workspace":      "1671-checker",
		"display":        map[string]any{"path": "design-doc.md"},
		"validation": map[string]any{
			"mode":          "managed",
			"target_state":  targetMap,
			"rule_coverage": map[string]any{"implementation_surfaces": []any{}, "additional_rules": []any{}},
			"coverage_gate": map[string]any{"requirement_ids": []any{"FR-1", "AC-1"}},
		},
	}
	content, err := json.Marshal(source)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ParseSource(content, "design", "fixture")
	if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected command field rejection, got %v", err)
	}
}

func TestParseSourceKeepsV2AndV3ReadOnly(t *testing.T) {
	for _, schemaVersion := range []int{2, 3} {
		content := []byte(`{"schema_version":` + strconv.Itoa(schemaVersion) + `,"kind":"design","workspace":"legacy","display":{},"validation":{}}`)
		parsed, err := ParseSource(content, "design", "legacy")
		if err != nil {
			t.Fatal(err)
		}
		if !parsed.ReadOnlyLegacy {
			t.Fatalf("schema v%d must be read-only compatibility input", schemaVersion)
		}
	}
}

func TestParseSourceRejectsEmptyRequirementsInventory(t *testing.T) {
	content := []byte(`{"schema_version":4,"kind":"requirements","workspace":"1671-checker","display":{"path":"requirements.md"},"validation":{"mode":"managed","cycle_start_issue_title":"AIDD Checker","input_gate":{},"completeness_gate":{"workspace":"1671-checker","requirements":[]},"requirements":[],"sections":[]}}`)
	_, err := ParseSource(content, "requirements", "fixture")
	if err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENTS_EMPTY") {
		t.Fatalf("expected empty Requirements rejection, got %v", err)
	}
}

func TestHistoricalSchemaV2CorpusRemainsReadOnly(t *testing.T) {
	repositoryRoot, err := filepath.Abs(filepath.Join("..", "..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	workspace := filepath.Join(repositoryRoot, "docs", "ai-driven-development", "workspaces", "1639-aidd-structured-data")
	for _, item := range []struct {
		Filename string
		Kind     string
	}{{"requirements.json", "requirements"}, {"design-doc.json", "design"}} {
		content, err := os.ReadFile(filepath.Join(workspace, item.Filename))
		if err != nil {
			t.Fatal(err)
		}
		parsed, err := ParseSource(content, item.Kind, item.Filename)
		if err != nil {
			t.Fatal(err)
		}
		if parsed.Envelope.SchemaVersion != 2 || !parsed.ReadOnlyLegacy {
			t.Fatalf("%s must remain schema v2 read-only input: schema=%d read_only=%v", item.Filename, parsed.Envelope.SchemaVersion, parsed.ReadOnlyLegacy)
		}
	}
}

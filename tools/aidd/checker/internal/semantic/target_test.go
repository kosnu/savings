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

func TestCanonicalIDOrderingUsesPrefixTupleAndArbitraryPrecisionNumbers(t *testing.T) {
	if err := requireCanonicalIDs(
		[]string{"NFR-1", "FR-1000001"},
		RequirementIDLess,
		"AIDD_REQUIREMENT_ORDER", "requirements", "fixture",
	); err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENT_ORDER") {
		t.Fatalf("expected prefix-first Requirement ordering rejection, got %v", err)
	}
	if err := requireCanonicalIDs(
		[]string{"FR-1000001", "NFR-1"},
		RequirementIDLess,
		"AIDD_REQUIREMENT_ORDER", "requirements", "fixture",
	); err != nil {
		t.Fatalf("prefix-first Requirement ordering rejected: %v", err)
	}
	if err := requireCanonicalIDs(
		[]string{"PB-999999999999999999999999", "PB-1000000000000000000000000"},
		numberedIDLess("PB-"),
		"AIDD_BEHAVIOR_ORDER", "product_behaviors", "fixture",
	); err != nil {
		t.Fatalf("arbitrary-precision numeric ordering rejected: %v", err)
	}
}

func validGoalSource(kind string) map[string]any {
	display := map[string]any{
		"path":  "goal.md",
		"title": "AIDD Phase Goal",
		"goal":  "対象工程の成果物と検証証拠を完成させる。",
		"context": map[string]any{
			"body": []any{"検証済みの入力だけを使って対象工程を実行する。"},
		},
	}
	if kind == "requirements_goal" {
		display["context"].(map[string]any)["constraints"] = []any{
			map[string]any{"id": "task-context", "text": "最新Issue本文だけをTask Context正本として扱う。"},
			map[string]any{"id": "phase-boundary", "text": "Requirements Goal内では実装しない。"},
		}
		display["context"].(map[string]any)["stop"] = []any{
			map[string]any{"id": "validation-failure", "text": "workspaceまたはRequirements Gateの検証が失敗した場合は停止する。"},
			map[string]any{"id": "scope-ambiguity", "text": "Issue本文から要求scopeを一意に決められない場合は停止する。"},
		}
		display["done"] = []any{
			map[string]any{"id": "complete-scope", "text": "最新Issue全体を覆うRequirementsと全要求IDを定義する。"},
			map[string]any{"id": "validated-artifact", "text": "Requirements Gateと生成成果物の同期検証を成功させる。"},
		}
		return map[string]any{
			"schema_version": 4,
			"kind":           kind,
			"workspace":      "1671-checker",
			"display":        display,
			"validation": map[string]any{
				"mode":                    "managed",
				"cycle_start_issue_title": "AIDD CheckerをGoで再設計する",
				"input_gate": map[string]any{
					"task_context": map[string]any{"source": "issue_body", "issue": "owner/repo#1671", "url": "https://github.com/owner/repo/issues/1671", "updated_at": "2026-08-28T00:00:00Z", "body_sha256": strings.Repeat("0", 64)},
					"direct_rules": []any{map[string]any{
						"id": "ai-driven.checker", "issue_evidence": "checker", "match": map[string]any{"field": "topics", "value": "checker"}, "reason": "checker契約を適用する",
					}}, "depends_on": []any{},
				},
				"completeness_gate": map[string]any{
					"issue_body_sha256": strings.Repeat("0", 64), "workspace": "1671-checker",
					"baseline":     map[string]any{"source": "none", "body_sha256": nil},
					"requirements": []any{map[string]any{"id": "FR-1", "status": "new", "issue_evidence": "checker"}},
					"sections":     []any{map[string]any{"id": "functional", "status": "new", "issue_evidence": "checker"}},
					"retired":      []any{},
				},
				"requirements": []any{map[string]any{"id": "FR-1", "text": "Goal契約をGoで厳密に検証する"}},
				"sections":     []any{map[string]any{"id": "functional", "heading": "機能要件", "blocks": []any{map[string]any{"id": "functional-requirements", "type": "requirements"}}}},
			},
		}
	}
	display["context"].(map[string]any)["constraints"] = []any{
		map[string]any{"id": "canonical-input", "text": "検証済みのcanonical requirements.jsonをread-only入力として扱う。"},
		map[string]any{"id": "phase-boundary", "text": "Design Goal内では実装しない。"},
	}
	display["context"].(map[string]any)["stop"] = []any{
		map[string]any{"id": "validation-failure", "text": "Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。"},
		map[string]any{"id": "scope-ambiguity", "text": "要求ごとの設計・検証scopeを一意に決められない場合は停止する。"},
	}
	display["done"] = []any{
		map[string]any{"id": "complete-scope", "text": "全Requirements IDとtask-owned範囲の完成状態を定義する。"},
		map[string]any{"id": "validated-artifact", "text": "Design Coverage Gateと生成成果物の同期検証後にcompletion receiptを固定する。"},
	}
	return map[string]any{
		"schema_version": 4,
		"kind":           kind,
		"workspace":      "1671-checker",
		"display":        display,
		"validation": map[string]any{
			"mode": "managed",
			"sections": []any{map[string]any{"id": "architecture", "heading": "Architecture", "blocks": []any{
				map[string]any{"id": "architecture-body", "type": "markdown", "markdown": "typed target stateを定義する。"},
				map[string]any{"id": "fr-1-design", "type": "evidence", "role": "design", "owner_id": "FR-1", "text": "FR-1の設計根拠をここに記録する。", "product_behavior_ids": []any{"PB-1"}},
				map[string]any{"id": "fr-1-verification", "type": "evidence", "role": "verification", "owner_id": "FR-1", "text": "FR-1の検証根拠をここに記録する。"},
				map[string]any{"id": "ac-1-design", "type": "evidence", "role": "design", "owner_id": "AC-1", "text": "AC-1の設計根拠をここに記録する。", "product_behavior_ids": []any{}},
				map[string]any{"id": "ac-1-verification", "type": "evidence", "role": "verification", "owner_id": "AC-1", "text": "AC-1の検証根拠をここに記録する。"},
			}}},
			"target_state":  validTarget(),
			"rule_coverage": model.RuleCoverage{ImplementationSurfaces: []string{}, AdditionalRules: []model.AdditionalRule{}},
			"coverage_gate": map[string]any{
				"requirements_sha256": strings.Repeat("0", 64), "workspace": "1671-checker",
				"requirement_ids": []any{"FR-1", "AC-1"}, "baseline": map[string]any{"source": "none", "body_sha256": nil},
				"coverage": []any{
					map[string]any{"id": "FR-1", "design_block_id": "fr-1-design", "verification_block_id": "fr-1-verification"},
					map[string]any{"id": "AC-1", "design_block_id": "ac-1-design", "verification_block_id": "ac-1-verification"},
				}, "baseline_sections": []any{},
			},
		},
	}
}

func parseGoalFixture(t *testing.T, source map[string]any) error {
	t.Helper()
	content, err := json.Marshal(source)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ParseSource(content, source["kind"].(string), "fixture")
	return err
}

func mutableSource(t *testing.T, source map[string]any) map[string]any {
	t.Helper()
	content, err := json.Marshal(source)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	if err := json.Unmarshal(content, &result); err != nil {
		t.Fatal(err)
	}
	return result
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

func TestManualProcedureRequiresSubstantiveText(t *testing.T) {
	verificationCase := model.VerificationCase{ID: "VC-1", Type: "manual", RequirementID: "AC-1", Procedure: "x"}
	err := validateVerificationContract(verificationCase, "verification_cases[0]", "design")
	if err == nil || !strings.Contains(err.Error(), "AIDD_MANUAL_PROCEDURE") {
		t.Fatalf("expected manual procedure diagnostic, got %v", err)
	}
	verificationCase.Procedure = "画面表示が崩れていないことを確認する"
	if err := validateVerificationContract(verificationCase, "verification_cases[0]", "design"); err != nil {
		t.Fatalf("valid manual procedure rejected: %v", err)
	}
}

func TestParseSourceAcceptsTypedGoalDisplayContracts(t *testing.T) {
	for _, kind := range []string{"requirements_goal", "design_goal"} {
		t.Run(kind, func(t *testing.T) {
			source := validGoalSource(kind)
			stop := source["display"].(map[string]any)["context"].(map[string]any)["stop"].([]any)
			source["display"].(map[string]any)["context"].(map[string]any)["stop"] = append(stop, map[string]any{
				"id": "task-specific-risk", "text": "task固有の停止条件が成立した場合は作業を停止する。",
			})
			if err := parseGoalFixture(t, source); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestGoalContractsMatchCanonicalWorkflowTable(t *testing.T) {
	repositoryRoot, err := filepath.Abs(filepath.Join("..", "..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(repositoryRoot, "docs", "ai-driven-development", "workflow.md"))
	if err != nil {
		t.Fatal(err)
	}
	workflow := string(content)
	for kind, phase := range map[string]string{"requirements_goal": "Requirements", "design_goal": "Design"} {
		previous := -1
		for _, field := range []string{"constraints", "stop", "done"} {
			for _, entry := range goalContracts[kind][field] {
				row := "| " + phase + " | " + field + " | `" + entry.ID + "` | " + entry.Text + " |"
				index := strings.Index(workflow, row)
				if index < 0 {
					t.Fatalf("canonical Goal contract row is missing: %s", row)
				}
				if index <= previous {
					t.Fatalf("canonical Goal contract row is out of order: %s", row)
				}
				previous = index
			}
		}
	}
}

func TestParseSourceRejectsIncompleteOrShadowGoalDisplay(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any)
		code   string
	}{
		{name: "missing title", code: "AIDD_GOAL_TITLE", mutate: func(display map[string]any) { delete(display, "title") }},
		{name: "shadow body", code: "AIDD_JSON_SHAPE", mutate: func(display map[string]any) { display["markdown"] = "# shadow" }},
		{name: "context shadow", code: "AIDD_JSON_SHAPE", mutate: func(display map[string]any) { display["context"].(map[string]any)["extra"] = true }},
		{name: "contract shadow", code: "AIDD_JSON_SHAPE", mutate: func(display map[string]any) {
			display["done"].([]any)[0].(map[string]any)["extra"] = true
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := validGoalSource("requirements_goal")
			test.mutate(source["display"].(map[string]any))
			err := parseGoalFixture(t, source)
			if err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestParseSourceRejectsNonSubstantiveOrMultilineGoalText(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any)
		code   string
	}{
		{name: "multiline title", code: "AIDD_GOAL_TITLE", mutate: func(display map[string]any) { display["title"] = "Goal\nTitle" }},
		{name: "short goal", code: "AIDD_GOAL_TEXT", mutate: func(display map[string]any) { display["goal"] = "x" }},
		{name: "empty body", code: "AIDD_GOAL_CONTEXT", mutate: func(display map[string]any) { display["context"].(map[string]any)["body"] = []any{} }},
		{name: "short body", code: "AIDD_GOAL_TEXT", mutate: func(display map[string]any) { display["context"].(map[string]any)["body"] = []any{"x"} }},
		{name: "multiline contract", code: "AIDD_GOAL_TEXT", mutate: func(display map[string]any) {
			display["context"].(map[string]any)["stop"].([]any)[0].(map[string]any)["text"] = "検証失敗なら停止条件を適用する。\n継続しない。"
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := validGoalSource("requirements_goal")
			test.mutate(source["display"].(map[string]any))
			err := parseGoalFixture(t, source)
			if err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestParseSourceRejectsGoalContractDrift(t *testing.T) {
	for _, kind := range []string{"requirements_goal", "design_goal"} {
		for _, field := range []string{"constraints", "stop", "done"} {
			entries := func(display map[string]any) []any {
				if field == "done" {
					return display["done"].([]any)
				}
				return display["context"].(map[string]any)[field].([]any)
			}
			for _, mutation := range []string{"missing", "order", "text", "duplicate", "invalid-id"} {
				t.Run(kind+"/"+field+"/"+mutation, func(t *testing.T) {
					source := validGoalSource(kind)
					display := source["display"].(map[string]any)
					items := entries(display)
					switch mutation {
					case "missing":
						items = items[1:]
					case "order":
						items[0], items[1] = items[1], items[0]
					case "text":
						items[0].(map[string]any)["text"] = "必須契約とは異なる実質的な説明をここへ記録する。"
					case "duplicate":
						items = append(items, map[string]any{"id": items[0].(map[string]any)["id"], "text": "重複した追加契約をここへ記録して検証する。"})
					case "invalid-id":
						items = append(items, map[string]any{"id": "Invalid_ID", "text": "不正な識別子を持つ追加契約をここへ記録する。"})
					}
					if field == "done" {
						display["done"] = items
					} else {
						display["context"].(map[string]any)[field] = items
					}
					err := parseGoalFixture(t, source)
					if err == nil || !strings.Contains(err.Error(), "AIDD_GOAL_CONTRACT") {
						t.Fatalf("expected Goal contract rejection, got %v", err)
					}
				})
			}
		}
	}
}

func TestParseSourceRejectsCrossVariantTargetStateFieldsIncludingZeroValues(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "manual profile", mutate: func(target map[string]any) {
			target["verification_cases"].([]any)[1].(map[string]any)["verification_profile_id"] = ""
		}},
		{name: "manual selector", mutate: func(target map[string]any) {
			target["verification_cases"].([]any)[1].(map[string]any)["selector"] = nil
		}},
		{name: "automated procedure", mutate: func(target map[string]any) {
			target["verification_cases"].([]any)[0].(map[string]any)["procedure"] = ""
		}},
		{name: "suite path", mutate: func(target map[string]any) {
			selector := target["verification_cases"].([]any)[0].(map[string]any)["selector"].(map[string]any)
			selector["path"] = ""
		}},
		{name: "suite name", mutate: func(target map[string]any) {
			selector := target["verification_cases"].([]any)[0].(map[string]any)["selector"].(map[string]any)
			selector["name"] = ""
		}},
		{name: "file locator name", mutate: func(target map[string]any) {
			locator := target["representations"].([]any)[0].(map[string]any)["locator"].(map[string]any)
			locator["name"] = ""
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			target := source["validation"].(map[string]any)["target_state"].(map[string]any)
			test.mutate(target)
			err := parseGoalFixture(t, source)
			if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected strict target-state variant rejection, got %v", err)
			}
		})
	}
}

func TestParseSourceRejectsCrossVariantRequirementFields(t *testing.T) {
	goal := validGoalSource("requirements_goal")
	goalRequirement := goal["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)
	goalRequirement["section_id"] = ""
	if err := parseGoalFixture(t, goal); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected Goal-only requirement shape rejection, got %v", err)
	}

	artifact := validGoalSource("requirements_goal")
	artifact["kind"] = "requirements"
	artifact["display"] = map[string]any{"path": "requirements.md", "preamble": "# Requirements"}
	if err := parseGoalFixture(t, artifact); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected artifact section_id requirement, got %v", err)
	}
}

func TestParseSourceRejectsEmptyDirectRuleInventory(t *testing.T) {
	source := validGoalSource("requirements_goal")
	source["validation"].(map[string]any)["input_gate"].(map[string]any)["direct_rules"] = []any{}
	if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), "AIDD_DIRECT_RULES_EMPTY") {
		t.Fatalf("expected non-empty direct rule rejection, got %v", err)
	}
}

func TestParseSourceRejectsInvalidRequirementSectionOwnership(t *testing.T) {
	artifact := func() map[string]any {
		source := validGoalSource("requirements_goal")
		source["kind"] = "requirements"
		source["display"] = map[string]any{"path": "requirements.md", "preamble": "# Requirements"}
		source["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)["section_id"] = "functional"
		return source
	}

	unknown := artifact()
	unknown["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)["section_id"] = "missing"
	if err := parseGoalFixture(t, unknown); err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENT_SECTION") {
		t.Fatalf("expected Requirement section ownership rejection, got %v", err)
	}

	missingBlock := artifact()
	blocks := missingBlock["validation"].(map[string]any)["sections"].([]any)[0].(map[string]any)["blocks"].([]any)
	blocks[0] = map[string]any{"id": "functional-body", "type": "markdown", "markdown": "Requirementの表示場所を定義する。"}
	if err := parseGoalFixture(t, missingBlock); err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENTS_BLOCK") {
		t.Fatalf("expected Requirement block ownership rejection, got %v", err)
	}
}

func TestParseSourceRequiresCompletenessSectionInventoryAlignment(t *testing.T) {
	source := validGoalSource("requirements_goal")
	source["validation"].(map[string]any)["completeness_gate"].(map[string]any)["sections"] = []any{}
	if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), "AIDD_COMPLETENESS_SECTIONS") {
		t.Fatalf("expected completeness section inventory rejection, got %v", err)
	}
}

func TestParseSourceRejectsNonCanonicalWorkspaceAndMultilineRequirement(t *testing.T) {
	workspace := validGoalSource("requirements_goal")
	workspace["workspace"] = "1671-Checker"
	if err := parseGoalFixture(t, workspace); err == nil || !strings.Contains(err.Error(), "AIDD_WORKSPACE") {
		t.Fatalf("expected canonical workspace rejection, got %v", err)
	}

	requirement := validGoalSource("requirements_goal")
	requirement["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)["text"] = "Goal契約を検証する。\n## Injected"
	if err := parseGoalFixture(t, requirement); err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENT_TEXT") {
		t.Fatalf("expected multiline requirement rejection, got %v", err)
	}
}

func TestParseSourceRejectsRequirementWithoutSubstantiveSummary(t *testing.T) {
	for _, kind := range []string{"requirements_goal", "requirements"} {
		for _, text := range []string{
			"FR-1",
			"FR-1 TODO",
			"FR-1 pending 未定",
			"FR-1 TODOです",
			"FR-1 未定です",
			"FR-1 TBD対応待ち",
			"FR-1 T\u200bODO",
			"ＦＲ－１ （未定）",
		} {
			t.Run(kind+"/"+text, func(t *testing.T) {
				source := validGoalSource("requirements_goal")
				if kind == "requirements" {
					source["kind"] = "requirements"
					source["display"] = map[string]any{"path": "requirements.md", "preamble": "# Requirements"}
					source["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)["section_id"] = "functional"
				}
				source["validation"].(map[string]any)["requirements"].([]any)[0].(map[string]any)["text"] = text
				if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), "AIDD_REQUIREMENT_TEXT") {
					t.Fatalf("expected placeholder Requirement rejection, got %v", err)
				}
			})
		}
	}
}

func TestParseSourceRejectsCrossStatusBaselineFields(t *testing.T) {
	tests := []struct {
		name  string
		entry map[string]any
	}{
		{
			name: "preserved replacement field",
			entry: map[string]any{
				"section_id": nil, "heading": "Previous", "content_sha256": strings.Repeat("0", 64), "status": "preserved", "design_block_id": "",
			},
		},
		{
			name: "replaced missing replacement field",
			entry: map[string]any{
				"section_id": nil, "heading": "Previous", "content_sha256": strings.Repeat("0", 64), "status": "replaced",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			gate := source["validation"].(map[string]any)["coverage_gate"].(map[string]any)
			gate["baseline_sections"] = []any{test.entry}
			if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected strict baseline status rejection, got %v", err)
			}
		})
	}
}

func TestParseSourceRejectsMissingOrNullVariantInventories(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{
			name: "missing implementation surfaces",
			mutate: func(validation map[string]any) {
				delete(validation["rule_coverage"].(map[string]any), "implementation_surfaces")
			},
		},
		{
			name: "null manual behavior inventory",
			mutate: func(validation map[string]any) {
				target := validation["target_state"].(map[string]any)
				target["verification_cases"].([]any)[1].(map[string]any)["product_behavior_ids"] = nil
			},
		},
		{
			name: "missing representation case inventory",
			mutate: func(validation map[string]any) {
				target := validation["target_state"].(map[string]any)
				delete(target["representations"].([]any)[0].(map[string]any), "verification_case_ids")
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			test.mutate(source["validation"].(map[string]any))
			if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected required field rejection, got %v", err)
			}
		})
	}
}

func TestParseSourceRejectsInvalidAdditionalRuleInventory(t *testing.T) {
	tests := []struct {
		name  string
		rules []any
		code  string
	}{
		{name: "empty", rules: []any{map[string]any{"id": "", "reason": "根拠を十分に記録する。"}}, code: "AIDD_ADDITIONAL_RULE"},
		{name: "multiline", rules: []any{map[string]any{"id": "ai-driven.workflow", "reason": "根拠を記録する。\n追加行"}}, code: "AIDD_ADDITIONAL_RULE"},
		{name: "duplicate", rules: []any{map[string]any{"id": "ai-driven.workflow", "reason": "第一の根拠を記録する。"}, map[string]any{"id": "ai-driven.workflow", "reason": "第二の根拠を記録する。"}}, code: "AIDD_ADDITIONAL_RULE_DUPLICATE"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			coverage := source["validation"].(map[string]any)["rule_coverage"].(map[string]any)
			coverage["additional_rules"] = test.rules
			if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestParseSourceRejectsInvalidProductBehaviorEvidenceOwnership(t *testing.T) {
	tests := []struct {
		name   string
		mutate func([]any)
		code   string
	}{
		{
			name: "missing",
			mutate: func(blocks []any) {
				blocks[1].(map[string]any)["product_behavior_ids"] = []any{}
			},
			code: "AIDD_BEHAVIOR_EVIDENCE_INVENTORY",
		},
		{
			name: "duplicate",
			mutate: func(blocks []any) {
				blocks[3].(map[string]any)["owner_id"] = "FR-1"
				blocks[3].(map[string]any)["product_behavior_ids"] = []any{"PB-1"}
			},
			code: "AIDD_BEHAVIOR_EVIDENCE_DUPLICATE",
		},
		{
			name: "wrong owner",
			mutate: func(blocks []any) {
				blocks[1].(map[string]any)["owner_id"] = "AC-1"
			},
			code: "AIDD_BEHAVIOR_EVIDENCE_OWNER",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			section := source["validation"].(map[string]any)["sections"].([]any)[0].(map[string]any)
			blocks := section["blocks"].([]any)
			test.mutate(blocks)
			section["blocks"] = blocks
			if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestParseSourceRejectsInvalidLocalCoverageReferences(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(map[string]any, map[string]any, []any)
		code   string
	}{
		{
			name: "unknown block",
			mutate: func(_ map[string]any, _ map[string]any, coverage []any) {
				coverage[0].(map[string]any)["design_block_id"] = "missing-design"
			},
			code: "AIDD_COVERAGE_EVIDENCE",
		},
		{
			name: "duplicate reference",
			mutate: func(_ map[string]any, gate map[string]any, coverage []any) {
				duplicate := map[string]any{"id": "FR-1", "design_block_id": "fr-1-design", "verification_block_id": "fr-1-verification"}
				gate["coverage"] = []any{coverage[0], duplicate, coverage[1]}
			},
			code: "AIDD_COVERAGE_DUPLICATE_REFERENCE",
		},
		{
			name: "identical evidence",
			mutate: func(validation map[string]any, _ map[string]any, _ []any) {
				sections := validation["sections"].([]any)
				blocks := sections[0].(map[string]any)["blocks"].([]any)
				blocks[2].(map[string]any)["text"] = blocks[1].(map[string]any)["text"]
			},
			code: "AIDD_COVERAGE_EVIDENCE_DUPLICATE",
		},
		{
			name: "missing requirement coverage",
			mutate: func(_ map[string]any, gate map[string]any, coverage []any) {
				gate["coverage"] = coverage[:1]
			},
			code: "AIDD_COVERAGE_INVENTORY",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			validation := source["validation"].(map[string]any)
			gate := validation["coverage_gate"].(map[string]any)
			coverage := gate["coverage"].([]any)
			test.mutate(validation, gate, coverage)
			if err := parseGoalFixture(t, source); err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

func TestParseSourceRejectsRetiredDesignGoalFields(t *testing.T) {
	for _, field := range []string{"scopes", "baseline_scopes"} {
		t.Run(field, func(t *testing.T) {
			source := mutableSource(t, validGoalSource("design_goal"))
			source["validation"].(map[string]any)[field] = []any{}
			err := parseGoalFixture(t, source)
			if err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected retired field rejection, got %v", err)
			}
		})
	}
}

func TestParseSourceRejectsUnmanagedDesignSource(t *testing.T) {
	source := mutableSource(t, validGoalSource("design_goal"))
	source["validation"].(map[string]any)["mode"] = "legacy_import"
	err := parseGoalFixture(t, source)
	if err == nil || !strings.Contains(err.Error(), "AIDD_VALIDATION_MODE") {
		t.Fatalf("expected managed Design mode rejection, got %v", err)
	}
}

func TestParseSourceRejectsIncompleteOrShadowArtifactDisplay(t *testing.T) {
	base := func() map[string]any {
		return map[string]any{
			"schema_version": 4,
			"kind":           "requirements",
			"workspace":      "1671-checker",
			"display":        map[string]any{"path": "requirements.md", "preamble": "# Requirements"},
			"validation": map[string]any{
				"mode":                    "managed",
				"cycle_start_issue_title": "AIDD CheckerをGoで再設計する",
				"input_gate":              map[string]any{},
				"completeness_gate":       map[string]any{"workspace": "1671-checker", "requirements": []any{map[string]any{"id": "FR-1"}}},
				"requirements":            []any{map[string]any{"id": "FR-1", "section_id": "functional", "text": "Goal契約をGoで厳密に検証する"}},
				"sections":                []any{},
			},
		}
	}
	missing := base()
	delete(missing["display"].(map[string]any), "preamble")
	if err := parseGoalFixture(t, missing); err == nil || !strings.Contains(err.Error(), "AIDD_DISPLAY_PREAMBLE") {
		t.Fatalf("expected preamble rejection, got %v", err)
	}
	shadow := base()
	shadow["display"].(map[string]any)["markdown"] = "# shadow"
	if err := parseGoalFixture(t, shadow); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected display shadow rejection, got %v", err)
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
		"display":        map[string]any{"path": "design-doc.md", "preamble": "# Design"},
		"validation": map[string]any{
			"mode":          "managed",
			"sections":      []any{map[string]any{"id": "architecture", "heading": "Architecture", "blocks": []any{map[string]any{"id": "architecture-body", "type": "markdown", "markdown": "typed target stateを定義する。"}}}},
			"target_state":  targetMap,
			"rule_coverage": map[string]any{"implementation_surfaces": []any{}, "additional_rules": []any{}},
			"coverage_gate": map[string]any{
				"requirements_sha256": strings.Repeat("0", 64), "workspace": "1671-checker",
				"requirement_ids": []any{"FR-1", "AC-1"}, "baseline": map[string]any{"source": "none", "body_sha256": nil},
				"coverage": []any{}, "baseline_sections": []any{},
			},
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
		content := []byte(`{"schema_version":` + strconv.Itoa(schemaVersion) + `,"kind":"design","workspace":"legacy","display":{"path":"design-doc.md","preamble":"# Design"},"validation":{}}`)
		parsed, err := ParseSource(content, "design", "legacy")
		if err != nil {
			t.Fatal(err)
		}
		if !parsed.ReadOnlyLegacy {
			t.Fatalf("schema v%d must be read-only compatibility input", schemaVersion)
		}
		if parsed.ArtifactDisplay == nil {
			t.Fatalf("schema v%d must retain its validated display envelope", schemaVersion)
		}
	}
}

func TestParseSourceRejectsIncompleteLegacyEnvelope(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		wantCode string
	}{
		{
			name:     "missing display",
			content:  `{"schema_version":2,"kind":"requirements","workspace":"legacy","validation":{}}`,
			wantCode: "AIDD_LEGACY_ENVELOPE",
		},
		{
			name:     "missing validation",
			content:  `{"schema_version":2,"kind":"requirements","workspace":"legacy","display":{"path":"requirements.md","preamble":"# Requirements"}}`,
			wantCode: "AIDD_LEGACY_ENVELOPE",
		},
		{
			name:     "null validation",
			content:  `{"schema_version":3,"kind":"design","workspace":"legacy","display":{"path":"design-doc.md","preamble":"# Design"},"validation":null}`,
			wantCode: "AIDD_LEGACY_ENVELOPE",
		},
		{
			name:     "unsupported kind",
			content:  `{"schema_version":3,"kind":"design_goal","workspace":"legacy","display":{},"validation":{}}`,
			wantCode: "AIDD_SOURCE_KIND",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := ParseSource([]byte(test.content), "", "legacy")
			if err == nil || !strings.Contains(err.Error(), test.wantCode) {
				t.Fatalf("expected %s, got %v", test.wantCode, err)
			}
		})
	}
}

func TestParseSourceRejectsEmptyRequirementsInventory(t *testing.T) {
	content := []byte(`{"schema_version":4,"kind":"requirements","workspace":"1671-checker","display":{"path":"requirements.md","preamble":"# Requirements"},"validation":{"mode":"managed","cycle_start_issue_title":"AIDD Checker","input_gate":{"task_context":{"source":"issue_body","issue":"owner/repo#1671","url":"https://github.com/owner/repo/issues/1671","updated_at":"2026-08-28T00:00:00Z","body_sha256":"0000000000000000000000000000000000000000000000000000000000000000"},"direct_rules":[],"depends_on":[]},"completeness_gate":{"issue_body_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace":"1671-checker","baseline":{"source":"none","body_sha256":null},"requirements":[],"sections":[{"id":"functional","status":"new","issue_evidence":"checker"}],"retired":[]},"requirements":[],"sections":[{"id":"functional","heading":"機能要件","blocks":[{"id":"functional-body","type":"markdown","markdown":"checkerを検証する。"}]}]}}`)
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

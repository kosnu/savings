package render

import (
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

func TestMarkdownGoldenRequirements(t *testing.T) {
	content := []byte(`{
  "schema_version": 4,
  "kind": "requirements",
  "workspace": "1671-checker",
  "display": {"path": "requirements.md", "preamble": "# Requirements"},
  "validation": {
    "mode": "managed",
    "cycle_start_issue_title": "AIDD Checker",
    "input_gate": {"task_context": {"source":"issue_body","issue":"owner/repo#1671","url":"https://github.com/owner/repo/issues/1671","updated_at":"2026-08-28T00:00:00Z","body_sha256":"0000000000000000000000000000000000000000000000000000000000000000"}, "direct_rules": [{"id":"ai-driven.checker","issue_evidence":"checker","match":{"field":"topics","value":"checker"},"reason":"checker契約を適用する"}], "depends_on": []},
    "completeness_gate": {"issue_body_sha256":"0000000000000000000000000000000000000000000000000000000000000000","workspace": "1671-checker","baseline":{"source":"none","body_sha256":null}, "requirements": [{"id": "FR-1","status":"new","issue_evidence":"profile"}],"sections":[{"id":"scope","status":"new","issue_evidence":"profile"}],"retired":[]},
    "requirements": [{"id": "FR-1", "section_id": "scope", "text": "profile を固定する"}],
    "sections": [{"id": "scope", "heading": "Scope", "blocks": [{"id":"scope-requirements","type": "requirements"}]}]
  }
}`)
	actual, err := Markdown(content, "requirements", "fixture")
	if err != nil {
		t.Fatal(err)
	}
	expected := "# Requirements\n\n## Cycle Identity\n\n- Cycle-start Issue title: AIDD Checker\n\n## Requirements Input Gate\n\n```json\n{\"depends_on\":[],\"direct_rules\":[{\"id\":\"ai-driven.checker\",\"issue_evidence\":\"checker\",\"match\":{\"field\":\"topics\",\"value\":\"checker\"},\"reason\":\"checker契約を適用する\"}],\"task_context\":{\"body_sha256\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"issue\":\"owner/repo#1671\",\"source\":\"issue_body\",\"updated_at\":\"2026-08-28T00:00:00Z\",\"url\":\"https://github.com/owner/repo/issues/1671\"}}\n```\n\n## Requirements Completeness Gate\n\n```json\n{\"baseline\":{\"body_sha256\":null,\"source\":\"none\"},\"issue_body_sha256\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"requirements\":[{\"id\":\"FR-1\",\"issue_evidence\":\"profile\",\"status\":\"new\"}],\"retired\":[],\"sections\":[{\"id\":\"scope\",\"issue_evidence\":\"profile\",\"status\":\"new\"}],\"workspace\":\"1671-checker\"}\n```\n\n## Scope\n\n- FR-1: profile を固定する\n\n## Rule Selection\n\n- Direct: `ai-driven.checker`。checker契約を適用する。\n- Conflict: none。\n"
	if actual != expected {
		t.Fatalf("Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", expected, actual)
	}
}

func TestMarkdownReturnsDiagnosticInsteadOfPanicking(t *testing.T) {
	content := []byte(`{"schema_version":4,"kind":"requirements","workspace":"valid-workspace","display":{"path":"requirements.md"},"validation":{"mode":"managed","cycle_start_issue_title":"title","input_gate":{},"completeness_gate":{"workspace":"valid-workspace","requirements":[{"id":"FR-1"}]},"requirements":[{"id":"FR-1","section_id":"s","text":"substantive"}],"sections":[]}}`)
	_, err := Markdown(content, "requirements", "fixture")
	if err == nil || !strings.Contains(err.Error(), "AIDD_DISPLAY_PREAMBLE") {
		t.Fatalf("expected display diagnostic, got %v", err)
	}
}

func TestMarkdownGoldenDesign(t *testing.T) {
	parsed := &semantic.ParsedSource{
		Envelope:        model.Source{Kind: "design"},
		ArtifactDisplay: &model.ArtifactDisplay{Path: "design-doc.md", Preamble: "# Design"},
		Design: &model.DesignValidation{
			Sections:     []model.Section{{ID: "architecture", Heading: "Architecture", Blocks: []model.Block{{ID: "architecture-body", Type: "markdown", Markdown: "Go checkerを使う"}}}},
			TargetState:  model.TargetState{},
			RuleCoverage: model.RuleCoverage{ImplementationSurfaces: []string{"checker"}, AdditionalRules: []model.AdditionalRule{}},
			CoverageGate: model.DesignCoverageGate{RequirementIDs: []string{"FR-1"}},
		},
	}
	actual, err := renderArtifact(parsed)
	if err != nil {
		t.Fatal(err)
	}
	expected := "# Design\n\n## Architecture\n\nGo checkerを使う\n\n## Target State\n\n```json\n{\"ownership_scopes\":null,\"product_behaviors\":null,\"representations\":null,\"verification_cases\":null}\n```\n\n## Rule Coverage\n\n```json\n{\"additional_rules\":[],\"implementation_surfaces\":[\"checker\"]}\n```\n\n## Design Coverage Gate\n\n```json\n{\"baseline\":{\"body_sha256\":null,\"source\":\"\"},\"baseline_sections\":null,\"coverage\":null,\"requirement_ids\":[\"FR-1\"],\"requirements_sha256\":\"\",\"workspace\":\"\"}\n```\n"
	if actual != expected {
		t.Fatalf("Design Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", expected, actual)
	}
}

func TestGoalMarkdownGoldens(t *testing.T) {
	display := model.GoalDisplay{
		Path:  "goal.md",
		Title: "Phase Goal",
		Goal:  "対象工程の成果物と検証証拠を完成させる。",
		Context: model.GoalContext{
			Body:        []string{"検証済みの入力だけを使って対象工程を実行する。"},
			Constraints: []model.GoalContractEntry{{ID: "phase-boundary", Text: "対象工程の責務境界を越える実装は行わない。"}},
			Stop:        []model.GoalContractEntry{{ID: "validation-failure", Text: "必須検証が失敗した場合は作業を停止する。"}},
		},
		Done: []model.GoalContractEntry{{ID: "validated-artifact", Text: "成果物と検証証拠の一致を確認して完了する。"}},
	}
	tests := []struct {
		name     string
		parsed   *semantic.ParsedSource
		expected string
	}{
		{
			name: "requirements goal",
			parsed: &semantic.ParsedSource{
				Envelope: model.Source{Kind: "requirements_goal"}, GoalDisplay: &display,
				Requirements: &model.RequirementsValidation{
					CycleStartIssueTitle: "Checker改善",
					InputGate:            model.RequirementsInputGate{DirectRules: []model.DirectRule{}, DependsOn: []model.RuleDependency{}},
					CompletenessGate:     model.RequirementsCompletenessGate{Requirements: []model.RequirementTransition{{ID: "FR-1"}}, Sections: []model.RequirementTransition{}, Retired: []model.RequirementRetirement{}},
				},
			},
			expected: "# Phase Goal\n\n## Goal\n\n対象工程の成果物と検証証拠を完成させる。\n\n## Context Packet\n\n検証済みの入力だけを使って対象工程を実行する。\n- Constraints [phase-boundary]: 対象工程の責務境界を越える実装は行わない。\n- Stop [validation-failure]: 必須検証が失敗した場合は作業を停止する。\n\n## Cycle Identity\n\n- Cycle-start Issue title: Checker改善\n\n## Requirements Input Gate\n\n```json\n{\"depends_on\":[],\"direct_rules\":[],\"task_context\":{\"body_sha256\":\"\",\"issue\":\"\",\"source\":\"\",\"updated_at\":\"\",\"url\":\"\"}}\n```\n\n## Requirements Completeness Gate\n\n```json\n{\"baseline\":{\"body_sha256\":null,\"source\":\"\"},\"issue_body_sha256\":\"\",\"requirements\":[{\"id\":\"FR-1\",\"issue_evidence\":null,\"status\":\"\"}],\"retired\":[],\"sections\":[],\"workspace\":\"\"}\n```\n\n## Done / Verification\n\n- [validated-artifact] 成果物と検証証拠の一致を確認して完了する。\n",
		},
		{
			name: "design goal",
			parsed: &semantic.ParsedSource{
				Envelope: model.Source{Kind: "design_goal"}, GoalDisplay: &display,
				Design: &model.DesignValidation{
					CoverageGate: model.DesignCoverageGate{RequirementIDs: []string{"FR-1"}, Coverage: []model.CoverageEntry{}, BaselineSections: []model.BaselineSection{}},
					RuleCoverage: model.RuleCoverage{ImplementationSurfaces: []string{}, AdditionalRules: []model.AdditionalRule{}},
					TargetState:  model.TargetState{ProductBehaviors: []model.ProductBehavior{}, VerificationCases: []model.VerificationCase{}, OwnershipScopes: []model.OwnershipScope{}, Representations: []model.Representation{}},
				},
			},
			expected: "# Phase Goal\n\n## Goal\n\n対象工程の成果物と検証証拠を完成させる。\n\n## Context Packet\n\n検証済みの入力だけを使って対象工程を実行する。\n- Constraints [phase-boundary]: 対象工程の責務境界を越える実装は行わない。\n- Stop [validation-failure]: 必須検証が失敗した場合は作業を停止する。\n\n## Design Coverage Gate\n\n```json\n{\"baseline\":{\"body_sha256\":null,\"source\":\"\"},\"baseline_sections\":[],\"coverage\":[],\"requirement_ids\":[\"FR-1\"],\"requirements_sha256\":\"\",\"workspace\":\"\"}\n```\n\n## Rule Coverage\n\n```json\n{\"additional_rules\":[],\"implementation_surfaces\":[]}\n```\n\n## Target State\n\n```json\n{\"ownership_scopes\":[],\"product_behaviors\":[],\"representations\":[],\"verification_cases\":[]}\n```\n\n## Done / Verification\n\n- [validated-artifact] 成果物と検証証拠の一致を確認して完了する。\n",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := renderGoal(test.parsed)
			if err != nil {
				t.Fatal(err)
			}
			if actual != test.expected {
				t.Fatalf("Goal Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", test.expected, actual)
			}
		})
	}
}

package render

import (
	"strings"
	"testing"
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
    "input_gate": {"task_context": {}, "direct_rules": [], "depends_on": []},
    "completeness_gate": {"workspace": "1671-checker", "requirements": [{"id": "FR-1"}]},
    "requirements": [{"id": "FR-1", "section_id": "scope", "text": "profile を固定する"}],
    "sections": [{"id": "scope", "heading": "Scope", "blocks": [{"type": "requirements"}]}]
  }
}`)
	actual, err := Markdown(content, "requirements", "fixture")
	if err != nil {
		t.Fatal(err)
	}
	expected := "# Requirements\n\n## Cycle Identity\n\n- Cycle-start Issue title: AIDD Checker\n\n## Requirements Input Gate\n\n```json\n{\"depends_on\":[],\"direct_rules\":[],\"task_context\":{}}\n```\n\n## Requirements Completeness Gate\n\n```json\n{\"requirements\":[{\"id\":\"FR-1\"}],\"workspace\":\"1671-checker\"}\n```\n\n## Scope\n\n- FR-1: profile を固定する\n\n## Rule Selection\n\n- Conflict: none。\n"
	if actual != expected {
		t.Fatalf("Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", expected, actual)
	}
}

func TestMarkdownReturnsDiagnosticInsteadOfPanicking(t *testing.T) {
	content := []byte(`{"schema_version":4,"kind":"requirements","workspace":"w","display":{"path":"requirements.md"},"validation":{"mode":"managed","cycle_start_issue_title":"title","input_gate":{},"completeness_gate":{"workspace":"w","requirements":[{"id":"FR-1"}]},"requirements":[{"id":"FR-1","section_id":"s","text":"substantive"}],"sections":[]}}`)
	_, err := Markdown(content, "requirements", "fixture")
	if err == nil || !strings.Contains(err.Error(), "AIDD_DISPLAY_PREAMBLE") {
		t.Fatalf("expected display diagnostic, got %v", err)
	}
}

func TestMarkdownGoldenDesign(t *testing.T) {
	source := map[string]any{
		"kind":    "design",
		"display": map[string]any{"preamble": "# Design"},
		"validation": map[string]any{
			"sections": []any{map[string]any{
				"id": "architecture", "heading": "Architecture",
				"blocks": []any{map[string]any{"type": "markdown", "markdown": "Go checkerを使う"}},
			}},
			"target_state":  map[string]any{"version": 1},
			"rule_coverage": map[string]any{"rules": []any{"ai-driven.checker"}},
			"coverage_gate": map[string]any{"requirement_ids": []any{"FR-1"}},
		},
	}
	actual, err := renderArtifact(source)
	if err != nil {
		t.Fatal(err)
	}
	expected := "# Design\n\n## Architecture\n\nGo checkerを使う\n\n## Target State\n\n```json\n{\"version\":1}\n```\n\n## Rule Coverage\n\n```json\n{\"rules\":[\"ai-driven.checker\"]}\n```\n\n## Design Coverage Gate\n\n```json\n{\"requirement_ids\":[\"FR-1\"]}\n```\n"
	if actual != expected {
		t.Fatalf("Design Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", expected, actual)
	}
}

func TestGoalMarkdownGoldens(t *testing.T) {
	display := map[string]any{
		"title": "Phase Goal", "goal": "対象を完成する",
		"context": map[string]any{
			"body":        []any{"Issue本文"},
			"constraints": []any{map[string]any{"id": "C-1", "text": "範囲を守る"}},
			"stop":        []any{},
		},
		"done": []any{map[string]any{"id": "D-1", "text": "検証済み"}},
	}
	tests := []struct {
		name     string
		source   map[string]any
		expected string
	}{
		{
			name: "requirements goal",
			source: map[string]any{
				"kind": "requirements_goal", "display": display,
				"validation": map[string]any{
					"cycle_start_issue_title": "Checker改善",
					"input_gate":              map[string]any{"rules": []any{}},
					"completeness_gate":       map[string]any{"requirements": []any{"FR-1"}},
				},
			},
			expected: "# Phase Goal\n\n## Goal\n\n対象を完成する\n\n## Context Packet\n\nIssue本文\n- Constraints [C-1]: 範囲を守る\n\n## Cycle Identity\n\n- Cycle-start Issue title: Checker改善\n\n## Requirements Input Gate\n\n```json\n{\"rules\":[]}\n```\n\n## Requirements Completeness Gate\n\n```json\n{\"requirements\":[\"FR-1\"]}\n```\n\n## Done / Verification\n\n- [D-1] 検証済み\n",
		},
		{
			name: "design goal",
			source: map[string]any{
				"kind": "design_goal", "display": display,
				"validation": map[string]any{
					"coverage_gate": map[string]any{"requirements": []any{"FR-1"}},
					"rule_coverage": map[string]any{"rules": []any{}},
					"target_state":  map[string]any{"representations": []any{}},
				},
			},
			expected: "# Phase Goal\n\n## Goal\n\n対象を完成する\n\n## Context Packet\n\nIssue本文\n- Constraints [C-1]: 範囲を守る\n\n## Design Coverage Gate\n\n```json\n{\"requirements\":[\"FR-1\"]}\n```\n\n## Rule Coverage\n\n```json\n{\"rules\":[]}\n```\n\n## Target State\n\n```json\n{\"representations\":[]}\n```\n\n## Done / Verification\n\n- [D-1] 検証済み\n",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := renderGoal(test.source)
			if err != nil {
				t.Fatal(err)
			}
			if actual != test.expected {
				t.Fatalf("Goal Markdown golden mismatch\nexpected:\n%s\nactual:\n%s", test.expected, actual)
			}
		})
	}
}

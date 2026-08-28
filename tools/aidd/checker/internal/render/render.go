package render

import (
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"

func Markdown(content []byte, expectedKind, artifact string) (result string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = ""
			err = diagnostic.New("AIDD_DISPLAY_SHAPE", "display", artifact, "display data is incomplete or has an invalid type", "valid display structure", fmt.Sprint(recovered))
		}
	}()
	parsed, err := semantic.ParseSource(content, expectedKind, artifact)
	if err != nil {
		return "", err
	}
	if parsed.ReadOnlyLegacy {
		return "", diagnostic.New("AIDD_LEGACY_RENDER", "schema_version", artifact, "schema v2/v3 rendering remains on the compatibility renderer", 4, parsed.Envelope.SchemaVersion)
	}
	var source map[string]any
	if err := canonical.Decode(content, artifact, &source); err != nil {
		return "", err
	}
	if strings.HasSuffix(parsed.Envelope.Kind, "_goal") {
		return renderGoal(source)
	}
	return renderArtifact(source)
}

func renderArtifact(source map[string]any) (string, error) {
	kind := source["kind"].(string)
	display, ok := source["display"].(map[string]any)
	if !ok {
		return "", diagnostic.New("AIDD_DISPLAY", "display", kind, "artifact display must be an object", nil, source["display"])
	}
	preamble, ok := display["preamble"].(string)
	if !ok || strings.TrimSpace(preamble) == "" {
		return "", diagnostic.New("AIDD_DISPLAY_PREAMBLE", "display.preamble", kind, "artifact display preamble must be non-empty", nil, display["preamble"])
	}
	validation := source["validation"].(map[string]any)
	blocks := []string{strings.TrimSpace(preamble)}
	if kind == "requirements" {
		blocks = append(blocks,
			"## Cycle Identity\n\n- Cycle-start Issue title: "+plain(validation["cycle_start_issue_title"].(string)),
			renderJSON("Requirements Input Gate", validation["input_gate"]),
			renderJSON("Requirements Completeness Gate", validation["completeness_gate"]),
		)
		sections, _ := validation["sections"].([]any)
		requirements, _ := validation["requirements"].([]any)
		blocks = append(blocks, renderSections(sections, requirements)...)
		blocks = append(blocks, renderRuleSelection(validation["input_gate"]))
	} else {
		sections, _ := validation["sections"].([]any)
		blocks = append(blocks, renderSections(sections, nil)...)
		blocks = append(blocks,
			renderJSON("Target State", validation["target_state"]),
			renderJSON("Rule Coverage", validation["rule_coverage"]),
			renderJSON("Design Coverage Gate", validation["coverage_gate"]),
		)
	}
	return strings.Join(trimBlocks(blocks), "\n\n") + "\n", nil
}

func renderGoal(source map[string]any) (string, error) {
	kind := source["kind"].(string)
	display, ok := source["display"].(map[string]any)
	if !ok {
		return "", diagnostic.New("AIDD_GOAL_DISPLAY", "display", kind, "Goal display must be an object", nil, source["display"])
	}
	title, _ := display["title"].(string)
	goal, _ := display["goal"].(string)
	context, _ := display["context"].(map[string]any)
	done, _ := display["done"].([]any)
	if title == "" || goal == "" || context == nil || done == nil {
		return "", diagnostic.New("AIDD_GOAL_DISPLAY", "display", kind, "Goal display is incomplete", nil, display)
	}
	validation := source["validation"].(map[string]any)
	blocks := []string{"# " + plain(title), "## Goal\n\n" + plain(strings.TrimSpace(goal))}
	contextLines := []string{}
	for _, item := range context["body"].([]any) {
		contextLines = append(contextLines, plain(item.(string)))
	}
	for _, field := range []string{"constraints", "stop"} {
		label := map[string]string{"constraints": "Constraints", "stop": "Stop"}[field]
		for _, raw := range context[field].([]any) {
			entry := raw.(map[string]any)
			contextLines = append(contextLines, fmt.Sprintf("- %s [%s]: %s", label, entry["id"], plain(entry["text"].(string))))
		}
	}
	blocks = append(blocks, "## Context Packet\n\n"+strings.Join(contextLines, "\n"))
	if kind == "requirements_goal" {
		blocks = append(blocks,
			"## Cycle Identity\n\n- Cycle-start Issue title: "+plain(validation["cycle_start_issue_title"].(string)),
			renderJSON("Requirements Input Gate", validation["input_gate"]),
			renderJSON("Requirements Completeness Gate", validation["completeness_gate"]),
		)
	} else {
		blocks = append(blocks,
			renderJSON("Design Coverage Gate", validation["coverage_gate"]),
			renderJSON("Rule Coverage", validation["rule_coverage"]),
			renderJSON("Target State", validation["target_state"]),
		)
	}
	doneLines := []string{}
	for _, raw := range done {
		entry := raw.(map[string]any)
		doneLines = append(doneLines, fmt.Sprintf("- [%s] %s", entry["id"], plain(entry["text"].(string))))
	}
	blocks = append(blocks, "## Done / Verification\n\n"+strings.Join(doneLines, "\n"))
	return strings.Join(trimBlocks(blocks), "\n\n") + "\n", nil
}

func renderSections(sections, requirements []any) []string {
	result := []string{}
	for _, raw := range sections {
		section := raw.(map[string]any)
		sectionID, _ := section["id"].(string)
		heading, _ := section["heading"].(string)
		parts := []string{}
		for _, blockRaw := range section["blocks"].([]any) {
			block := blockRaw.(map[string]any)
			switch block["type"] {
			case "markdown":
				parts = append(parts, strings.TrimSpace(block["markdown"].(string)))
			case "evidence":
				parts = append(parts, fmt.Sprintf("%s %s: %s", plain(block["owner_id"].(string)), block["role"], plain(block["text"].(string))))
			case "requirements":
				lines := []string{}
				for _, requirementRaw := range requirements {
					requirement := requirementRaw.(map[string]any)
					if requirement["section_id"] == sectionID {
						lines = append(lines, fmt.Sprintf("- %s: %s", requirement["id"], plain(requirement["text"].(string))))
					}
				}
				parts = append(parts, strings.Join(lines, "\n"))
			}
		}
		body := strings.Join(trimBlocks(parts), "\n\n")
		sectionText := "## " + plain(heading)
		if body != "" {
			sectionText += "\n\n" + body
		}
		result = append(result, sectionText)
	}
	return result
}

func renderRuleSelection(raw any) string {
	gate := raw.(map[string]any)
	lines := []string{"## Rule Selection", ""}
	for _, rawRule := range gate["direct_rules"].([]any) {
		rule := rawRule.(map[string]any)
		lines = append(lines, fmt.Sprintf("- Direct: `%s`。%s。", rule["id"], plain(strings.TrimSuffix(rule["reason"].(string), "。"))))
	}
	for _, rawDependency := range gate["depends_on"].([]any) {
		dependency := rawDependency.(map[string]any)
		lines = append(lines, fmt.Sprintf("- Depends-on: `%s`（via `%s`）。", dependency["id"], dependency["via"]))
	}
	lines = append(lines, "- Conflict: none。")
	return strings.Join(lines, "\n")
}

func renderJSON(heading string, value any) string {
	encoded, err := canonical.Marshal(value)
	if err != nil {
		panic(err)
	}
	return fmt.Sprintf("## %s\n\n```json\n%s\n```", heading, encoded)
}

func plain(value string) string {
	var builder strings.Builder
	for _, character := range value {
		if strings.ContainsRune(punctuation, character) {
			builder.WriteRune('\\')
		}
		builder.WriteRune(character)
	}
	return builder.String()
}

func trimBlocks(values []string) []string {
	result := []string{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

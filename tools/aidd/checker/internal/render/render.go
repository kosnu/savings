package render

import (
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"

func Markdown(content []byte, expectedKind, artifact string) (result string, err error) {
	parsed, err := semantic.ParseSource(content, expectedKind, artifact)
	if err != nil {
		return "", err
	}
	if parsed.ReadOnlyLegacy {
		return "", diagnostic.New("AIDD_LEGACY_RENDER", "schema_version", artifact, "schema v2/v3 rendering remains on the compatibility renderer", 4, parsed.Envelope.SchemaVersion)
	}
	if strings.HasSuffix(parsed.Envelope.Kind, "_goal") {
		return renderGoal(parsed)
	}
	return renderArtifact(parsed)
}

func renderArtifact(parsed *semantic.ParsedSource) (string, error) {
	kind := parsed.Envelope.Kind
	display := *parsed.ArtifactDisplay
	blocks := []string{strings.TrimSpace(display.Preamble)}
	if kind == "requirements" {
		validation := parsed.Requirements
		blocks = append(blocks,
			"## Cycle Identity\n\n- Cycle-start Issue title: "+plain(validation.CycleStartIssueTitle),
			renderJSON("Requirements Input Gate", validation.InputGate),
			renderJSON("Requirements Completeness Gate", validation.CompletenessGate),
		)
		blocks = append(blocks, renderSections(validation.Sections, validation.Requirements)...)
		blocks = append(blocks, renderRuleSelection(validation.InputGate))
	} else {
		validation := parsed.Design
		blocks = append(blocks, renderSections(validation.Sections, nil)...)
		blocks = append(blocks,
			renderJSON("Target State", validation.TargetState),
			renderJSON("Rule Coverage", validation.RuleCoverage),
			renderJSON("Design Coverage Gate", validation.CoverageGate),
		)
	}
	return strings.Join(trimBlocks(blocks), "\n\n") + "\n", nil
}

func renderGoal(parsed *semantic.ParsedSource) (string, error) {
	kind := parsed.Envelope.Kind
	display := *parsed.GoalDisplay
	blocks := []string{"# " + plain(display.Title), "## Goal\n\n" + plain(strings.TrimSpace(display.Goal))}
	contextLines := []string{}
	for _, item := range display.Context.Body {
		contextLines = append(contextLines, plain(item))
	}
	for _, field := range []struct {
		label   string
		entries []model.GoalContractEntry
	}{
		{label: "Constraints", entries: display.Context.Constraints},
		{label: "Stop", entries: display.Context.Stop},
	} {
		for _, entry := range field.entries {
			contextLines = append(contextLines, fmt.Sprintf("- %s [%s]: %s", field.label, entry.ID, plain(entry.Text)))
		}
	}
	blocks = append(blocks, "## Context Packet\n\n"+strings.Join(contextLines, "\n"))
	if kind == "requirements_goal" {
		validation := parsed.Requirements
		blocks = append(blocks,
			"## Cycle Identity\n\n- Cycle-start Issue title: "+plain(validation.CycleStartIssueTitle),
			renderJSON("Requirements Input Gate", validation.InputGate),
			renderJSON("Requirements Completeness Gate", validation.CompletenessGate),
		)
	} else {
		validation := parsed.Design
		blocks = append(blocks,
			renderJSON("Design Coverage Gate", validation.CoverageGate),
			renderJSON("Rule Coverage", validation.RuleCoverage),
			renderJSON("Target State", validation.TargetState),
		)
	}
	doneLines := []string{}
	for _, entry := range display.Done {
		doneLines = append(doneLines, fmt.Sprintf("- [%s] %s", entry.ID, plain(entry.Text)))
	}
	blocks = append(blocks, "## Done / Verification\n\n"+strings.Join(doneLines, "\n"))
	return strings.Join(trimBlocks(blocks), "\n\n") + "\n", nil
}

func renderSections(sections []model.Section, requirements []model.Requirement) []string {
	result := []string{}
	for _, section := range sections {
		parts := []string{}
		for _, block := range section.Blocks {
			switch block.Type {
			case "markdown":
				parts = append(parts, strings.TrimSpace(block.Markdown))
			case "evidence":
				parts = append(parts, fmt.Sprintf("%s %s: %s", plain(block.OwnerID), block.Role, plain(block.Text)))
			case "requirements":
				lines := []string{}
				for _, requirement := range requirements {
					if requirement.SectionID == section.ID {
						lines = append(lines, fmt.Sprintf("- %s: %s", requirement.ID, plain(requirement.Text)))
					}
				}
				parts = append(parts, strings.Join(lines, "\n"))
			}
		}
		body := strings.Join(trimBlocks(parts), "\n\n")
		sectionText := "## " + plain(section.Heading)
		if body != "" {
			sectionText += "\n\n" + body
		}
		result = append(result, sectionText)
	}
	return result
}

func renderRuleSelection(gate model.RequirementsInputGate) string {
	lines := []string{"## Rule Selection", ""}
	for _, rule := range gate.DirectRules {
		lines = append(lines, fmt.Sprintf("- Direct: `%s`。%s。", rule.ID, plain(strings.TrimSuffix(rule.Reason, "。"))))
	}
	for _, dependency := range gate.DependsOn {
		lines = append(lines, fmt.Sprintf("- Depends-on: `%s`（via `%s`）。", dependency.ID, dependency.Via))
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

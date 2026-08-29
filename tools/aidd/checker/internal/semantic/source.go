package semantic

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
)

var (
	requirementIDPattern              = regexp.MustCompile(`^(?:FR|NFR|AC)-[1-9][0-9]*$`)
	goalContractIDPattern             = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	requirementPlaceholderPattern     = regexp.MustCompile(`(?:pending|tbd|todo|未定)`)
	requirementPlaceholderOnlyPattern = regexp.MustCompile(`^(?:(?:pending|tbd|todo|未定)(?:(?:です|である|対応待ち|待ち))*)+$`)
)

const minimumGoalTextRunes = 8

var goalContracts = map[string]map[string][]model.GoalContractEntry{
	"requirements_goal": {
		"constraints": {
			{ID: "task-context", Text: "最新Issue本文だけをTask Context正本として扱う。"},
			{ID: "phase-boundary", Text: "Requirements Goal内では実装しない。"},
		},
		"stop": {
			{ID: "validation-failure", Text: "workspaceまたはRequirements Gateの検証が失敗した場合は停止する。"},
			{ID: "scope-ambiguity", Text: "Issue本文から要求scopeを一意に決められない場合は停止する。"},
		},
		"done": {
			{ID: "complete-scope", Text: "最新Issue全体を覆うRequirementsと全要求IDを定義する。"},
			{ID: "validated-artifact", Text: "Requirements Gateと生成成果物の同期検証を成功させる。"},
		},
	},
	"design_goal": {
		"constraints": {
			{ID: "canonical-input", Text: "検証済みのcanonical requirements.jsonをread-only入力として扱う。"},
			{ID: "phase-boundary", Text: "Design Goal内では実装しない。"},
		},
		"stop": {
			{ID: "validation-failure", Text: "Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。"},
			{ID: "scope-ambiguity", Text: "要求ごとの設計・検証scopeを一意に決められない場合は停止する。"},
		},
		"done": {
			{ID: "complete-scope", Text: "全Requirements IDとtask-owned範囲の完成状態を定義する。"},
			{ID: "validated-artifact", Text: "Design Coverage Gateと生成成果物の同期検証後にcompletion receiptを固定する。"},
		},
	},
}

type ParsedSource struct {
	Envelope        model.Source
	ArtifactDisplay *model.ArtifactDisplay
	GoalDisplay     *model.GoalDisplay
	Requirements    *model.RequirementsValidation
	Design          *model.DesignValidation
	ReadOnlyLegacy  bool
}

func ParseSource(content []byte, expectedKind, artifact string) (*ParsedSource, error) {
	var source model.Source
	if err := canonical.Decode(content, artifact, &source); err != nil {
		return nil, err
	}
	if expectedKind != "" && source.Kind != expectedKind {
		return nil, diagnostic.New("AIDD_SOURCE_KIND", "kind", artifact, "source kind does not match the requested kind", expectedKind, source.Kind)
	}
	if err := pathcontract.ValidateWorkspaceName(source.Workspace); err != nil {
		return nil, err
	}
	parsed := &ParsedSource{Envelope: source}
	switch source.SchemaVersion {
	case 2, 3:
		display, err := parseLegacyEnvelope(source, artifact)
		if err != nil {
			return nil, err
		}
		parsed.ArtifactDisplay = display
		parsed.ReadOnlyLegacy = true
		return parsed, nil
	case model.CurrentSchemaVersion:
	default:
		return nil, diagnostic.New("AIDD_SOURCE_SCHEMA", "schema_version", artifact, "AIDD source schema is unsupported", []int{2, 3, model.CurrentSchemaVersion}, source.SchemaVersion)
	}
	switch source.Kind {
	case "requirements", "design":
		display, err := parseArtifactDisplay(source.Display, source.Kind, artifact)
		if err != nil {
			return nil, err
		}
		parsed.ArtifactDisplay = display
	case "requirements_goal", "design_goal":
		display, err := parseGoalDisplay(source.Display, source.Kind, artifact)
		if err != nil {
			return nil, err
		}
		parsed.GoalDisplay = display
	default:
		return nil, diagnostic.New("AIDD_SOURCE_KIND", "kind", artifact, "managed AIDD source kind is unsupported", []string{"requirements", "requirements_goal", "design", "design_goal"}, source.Kind)
	}

	switch source.Kind {
	case "requirements", "requirements_goal":
		validation, err := decodeRequirementsValidation(source.Validation, source.Kind, artifact)
		if err != nil {
			return nil, err
		}
		if err := validateRequirements(validation, source.Kind, source.Workspace, artifact); err != nil {
			return nil, err
		}
		if source.Kind == "requirements" {
			if err := ValidateRequirementsStructure(validation.Requirements, validation.Sections, artifact); err != nil {
				return nil, err
			}
		}
		parsed.Requirements = validation
	case "design", "design_goal":
		validation, err := decodeDesignValidation(source.Validation, artifact)
		if err != nil {
			return nil, err
		}
		if validation.Mode != "managed" {
			return nil, diagnostic.New("AIDD_VALIDATION_MODE", "validation.mode", artifact, "managed source requires managed validation mode", "managed", validation.Mode)
		}
		requirementIDs, err := coverageRequirementIDs(validation.CoverageGate, artifact)
		if err != nil {
			return nil, err
		}
		if err := validateRuleCoverage(validation.RuleCoverage, artifact); err != nil {
			return nil, err
		}
		if err := ValidateTargetState(&validation.TargetState, requirementIDs, artifact); err != nil {
			return nil, err
		}
		if err := validateDesignStructure(validation, artifact); err != nil {
			return nil, err
		}
		parsed.Design = validation
	}
	return parsed, nil
}

func parseLegacyEnvelope(source model.Source, artifact string) (*model.ArtifactDisplay, error) {
	if source.Kind != "requirements" && source.Kind != "design" {
		return nil, diagnostic.New("AIDD_SOURCE_KIND", "kind", artifact, "legacy AIDD source kind is unsupported", []string{"requirements", "design"}, source.Kind)
	}
	if len(source.Display) == 0 {
		return nil, diagnostic.New("AIDD_LEGACY_ENVELOPE", "display", artifact, "legacy AIDD source must contain the complete read-only envelope", "display object", "missing")
	}
	display, err := parseArtifactDisplay(source.Display, source.Kind, artifact)
	if err != nil {
		return nil, err
	}
	if len(source.Validation) == 0 {
		return nil, diagnostic.New("AIDD_LEGACY_ENVELOPE", "validation", artifact, "legacy AIDD source must contain the complete read-only envelope", "validation object", "missing")
	}
	var validation map[string]json.RawMessage
	if err := canonical.Decode(source.Validation, artifact+".validation", &validation); err != nil {
		return nil, err
	}
	if validation == nil {
		return nil, diagnostic.New("AIDD_LEGACY_ENVELOPE", "validation", artifact, "legacy AIDD validation must be a JSON object", "object", "null")
	}
	return display, nil
}

func parseArtifactDisplay(raw json.RawMessage, kind, artifact string) (*model.ArtifactDisplay, error) {
	var display model.ArtifactDisplay
	if err := canonical.Decode(raw, artifact+".display", &display); err != nil {
		return nil, err
	}
	expected := map[string]string{"requirements": "requirements.md", "design": "design-doc.md"}[kind]
	if display.Path != expected {
		return nil, diagnostic.New("AIDD_DISPLAY_PATH", "display.path", artifact, "display path does not match the source kind", expected, display.Path)
	}
	if strings.TrimSpace(display.Preamble) == "" {
		return nil, diagnostic.New("AIDD_DISPLAY_PREAMBLE", "display.preamble", artifact, "artifact display preamble must be non-empty", "non-empty string", display.Preamble)
	}
	return &display, nil
}

func parseGoalDisplay(raw json.RawMessage, kind, artifact string) (*model.GoalDisplay, error) {
	var display model.GoalDisplay
	if err := canonical.Decode(raw, artifact+".display", &display); err != nil {
		return nil, err
	}
	if display.Path != "goal.md" {
		return nil, diagnostic.New("AIDD_DISPLAY_PATH", "display.path", artifact, "display path does not match the source kind", "goal.md", display.Path)
	}
	if strings.TrimSpace(display.Title) == "" || strings.ContainsAny(display.Title, "\r\n") {
		return nil, diagnostic.New("AIDD_GOAL_TITLE", "display.title", artifact, "Goal title must be a non-empty single line", "non-empty single-line string", display.Title)
	}
	if err := validateGoalText(display.Goal, "display.goal", artifact); err != nil {
		return nil, err
	}
	if len(display.Context.Body) == 0 {
		return nil, diagnostic.New("AIDD_GOAL_CONTEXT", "display.context.body", artifact, "Goal context body must be non-empty", "non-empty string array", display.Context.Body)
	}
	for index, value := range display.Context.Body {
		if err := validateGoalText(value, "display.context.body["+strconv.Itoa(index)+"]", artifact); err != nil {
			return nil, err
		}
	}
	for _, field := range []struct {
		name    string
		entries []model.GoalContractEntry
	}{
		{name: "constraints", entries: display.Context.Constraints},
		{name: "stop", entries: display.Context.Stop},
		{name: "done", entries: display.Done},
	} {
		if err := validateGoalContracts(field.entries, goalContracts[kind][field.name], "display."+map[string]string{"constraints": "context.constraints", "stop": "context.stop", "done": "done"}[field.name], artifact); err != nil {
			return nil, err
		}
	}
	return &display, nil
}

func validateGoalContracts(entries, required []model.GoalContractEntry, path, artifact string) error {
	ids := map[string]struct{}{}
	for index, entry := range entries {
		entryPath := path + "[" + strconv.Itoa(index) + "]"
		if !goalContractIDPattern.MatchString(entry.ID) {
			return diagnostic.New("AIDD_GOAL_CONTRACT_ID", entryPath+".id", artifact, "Goal contract ID must use lowercase ASCII kebab-case", "lowercase ASCII kebab-case", entry.ID)
		}
		if _, exists := ids[entry.ID]; exists {
			return diagnostic.New("AIDD_GOAL_CONTRACT_ID", entryPath+".id", artifact, "Goal contract IDs must be unique", "unique ID", entry.ID)
		}
		ids[entry.ID] = struct{}{}
		if err := validateGoalText(entry.Text, entryPath+".text", artifact); err != nil {
			return err
		}
	}
	if len(entries) < len(required) {
		return diagnostic.New("AIDD_GOAL_CONTRACT_ORDER", path, artifact, "Goal contract must contain required IDs in canonical order", contractIDs(required), contractIDs(entries))
	}
	for index, expected := range required {
		actual := entries[index]
		if actual.ID != expected.ID {
			return diagnostic.New("AIDD_GOAL_CONTRACT_ORDER", path, artifact, "Goal contract must contain required IDs in canonical order", contractIDs(required), contractIDs(entries))
		}
		if actual.Text != expected.Text {
			return diagnostic.New("AIDD_GOAL_CONTRACT_TEXT", path+"["+strconv.Itoa(index)+"].text", artifact, "required Goal contract ID must use canonical text", expected.Text, actual.Text)
		}
	}
	return nil
}

func validateGoalText(value, path, artifact string) error {
	if strings.ContainsAny(value, "\r\n") || len([]rune(substantive(value))) < minimumGoalTextRunes {
		return diagnostic.New("AIDD_GOAL_TEXT", path, artifact, "Goal text must be a substantive single line", "at least 8 substantive characters on one line", value)
	}
	return nil
}

func contractIDs(entries []model.GoalContractEntry) []string {
	ids := make([]string, len(entries))
	for index, entry := range entries {
		ids[index] = entry.ID
	}
	return ids
}

func validateRequirements(validation *model.RequirementsValidation, kind, workspace, artifact string) error {
	if validation.Mode != "managed" {
		return diagnostic.New("AIDD_VALIDATION_MODE", "validation.mode", artifact, "managed source requires managed validation mode", "managed", validation.Mode)
	}
	if substantive(validation.CycleStartIssueTitle) == "" || strings.ContainsAny(validation.CycleStartIssueTitle, "\r\n") {
		return diagnostic.New("AIDD_ISSUE_TITLE", "validation.cycle_start_issue_title", artifact, "cycle-start Issue title must be a substantive single line", "substantive single-line string", validation.CycleStartIssueTitle)
	}
	if len(validation.Requirements) == 0 {
		return diagnostic.New("AIDD_REQUIREMENTS_EMPTY", "validation.requirements", artifact, "managed Requirements must contain at least one Requirement", "non-empty Requirement inventory", validation.Requirements)
	}
	if len(validation.InputGate.DirectRules) == 0 {
		return diagnostic.New("AIDD_DIRECT_RULES_EMPTY", "validation.input_gate.direct_rules", artifact, "managed Requirements must select at least one direct rule", "non-empty direct rule inventory", validation.InputGate.DirectRules)
	}
	ids := make([]string, 0, len(validation.Requirements))
	for index, requirement := range validation.Requirements {
		path := "validation.requirements[" + strconv.Itoa(index) + "]"
		if !requirementIDPattern.MatchString(requirement.ID) {
			return diagnostic.New("AIDD_REQUIREMENT_ID", path+".id", artifact, "Requirement ID is invalid", "FR/NFR/AC-number", requirement.ID)
		}
		if err := validateRequirementText(requirement.ID, requirement.Text, path+".text", artifact); err != nil {
			return err
		}
		if kind == "requirements" && requirement.SectionID == "" {
			return diagnostic.New("AIDD_REQUIREMENT_SECTION", path+".section_id", artifact, "Requirements artifact must own a section ID", nil, requirement.SectionID)
		}
		ids = append(ids, requirement.ID)
	}
	if err := requireCanonicalIDs(ids, requirementSortKey, "AIDD_REQUIREMENT_ORDER", "validation.requirements", artifact); err != nil {
		return err
	}
	gate := validation.CompletenessGate
	if gate.Workspace != workspace {
		return diagnostic.New("AIDD_WORKSPACE_MISMATCH", "validation.completeness_gate.workspace", artifact, "completeness gate workspace must match source workspace", workspace, gate.Workspace)
	}
	gateIDs := make([]string, len(gate.Requirements))
	for index := range gate.Requirements {
		gateIDs[index] = gate.Requirements[index].ID
	}
	if !equalStrings(gateIDs, ids) {
		return diagnostic.New("AIDD_REQUIREMENT_INVENTORY", "validation.completeness_gate.requirements", artifact, "completeness gate must inventory every Requirement in canonical order", ids, gateIDs)
	}
	sectionIDs := make([]string, len(validation.Sections))
	for index, section := range validation.Sections {
		sectionIDs[index] = section.ID
	}
	gateSectionIDs := make([]string, len(gate.Sections))
	for index, section := range gate.Sections {
		gateSectionIDs[index] = section.ID
	}
	if !equalStrings(gateSectionIDs, sectionIDs) {
		return diagnostic.New("AIDD_COMPLETENESS_SECTIONS", "validation.completeness_gate.sections", artifact, "completeness gate must inventory every section in canonical order", sectionIDs, gateSectionIDs)
	}
	return nil
}

func validateRequirementText(id, value, path, artifact string) error {
	if strings.ContainsAny(value, "\r\n") {
		return diagnostic.New("AIDD_REQUIREMENT_TEXT", path, artifact, "Requirement text must contain a substantive non-placeholder summary on one line", "single-line summary with at least 2 substantive characters after the Requirement ID and placeholder terms", value)
	}
	normalized := substantive(strings.ReplaceAll(normalizedText(value), normalizedText(id), ""))
	withoutPlaceholders := requirementPlaceholderPattern.ReplaceAllString(normalized, "")
	if requirementPlaceholderOnlyPattern.MatchString(normalized) || len([]rune(substantive(withoutPlaceholders))) < 2 {
		return diagnostic.New("AIDD_REQUIREMENT_TEXT", path, artifact, "Requirement text must contain a substantive non-placeholder summary on one line", "single-line summary with at least 2 substantive characters after the Requirement ID and placeholder terms", value)
	}
	return nil
}

func coverageRequirementIDs(gate model.DesignCoverageGate, artifact string) ([]string, error) {
	if len(gate.RequirementIDs) == 0 {
		return nil, diagnostic.New("AIDD_COVERAGE_REQUIREMENTS", "validation.coverage_gate.requirement_ids", artifact, "coverage gate must own at least one Requirement", nil, gate.RequirementIDs)
	}
	if err := requireCanonicalIDs(gate.RequirementIDs, requirementSortKey, "AIDD_COVERAGE_REQUIREMENTS", "validation.coverage_gate.requirement_ids", artifact); err != nil {
		return nil, err
	}
	return gate.RequirementIDs, nil
}

func validateRuleCoverage(coverage model.RuleCoverage, artifact string) error {
	surfaces := map[string]struct{}{}
	for index, surface := range coverage.ImplementationSurfaces {
		path := "validation.rule_coverage.implementation_surfaces[" + strconv.Itoa(index) + "]"
		if strings.TrimSpace(surface) == "" || strings.ContainsAny(surface, "\r\n") {
			return diagnostic.New("AIDD_RULE_SURFACE", path, artifact, "implementation surface must be a non-empty single line", "non-empty single-line string", surface)
		}
		if _, duplicate := surfaces[surface]; duplicate {
			return diagnostic.New("AIDD_RULE_SURFACE_DUPLICATE", path, artifact, "implementation surfaces must be unique", "unique surface ID", surface)
		}
		surfaces[surface] = struct{}{}
	}
	additional := map[string]struct{}{}
	for index, rule := range coverage.AdditionalRules {
		path := "validation.rule_coverage.additional_rules[" + strconv.Itoa(index) + "]"
		if strings.TrimSpace(rule.ID) == "" || strings.ContainsAny(rule.ID, "\r\n") || strings.TrimSpace(rule.Reason) == "" || strings.ContainsAny(rule.Reason, "\r\n") {
			return diagnostic.New("AIDD_ADDITIONAL_RULE", path, artifact, "additional rule ID and reason must be non-empty single lines", "non-empty single-line strings", rule)
		}
		if _, duplicate := additional[rule.ID]; duplicate {
			return diagnostic.New("AIDD_ADDITIONAL_RULE_DUPLICATE", path+".id", artifact, "additional rule IDs must be unique", "unique rule ID", rule.ID)
		}
		additional[rule.ID] = struct{}{}
	}
	return nil
}

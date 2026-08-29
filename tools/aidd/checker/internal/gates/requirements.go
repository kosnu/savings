package gates

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/requirementscontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

func ValidateRequirements(ctx context.Context, snapshot *repository.Snapshot, input RequirementsInput) (*semantic.ParsedSource, error) {
	expectedKind := input.Kind
	if expectedKind != "requirements" && expectedKind != "requirements_goal" {
		return nil, diagnostic.New("AIDD_REQUIREMENTS_KIND", "kind", "requirements_gate", "Requirements gate kind is unsupported", []string{"requirements", "requirements_goal"}, expectedKind)
	}
	sectionContract, err := requirementscontract.Load(snapshot)
	if err != nil {
		return nil, err
	}
	parsed, err := semantic.ParseSource(input.Document, expectedKind, expectedKind)
	if err != nil {
		return nil, err
	}
	if parsed.ReadOnlyLegacy {
		return nil, diagnostic.New("AIDD_LEGACY_PROMOTION", "schema_version", expectedKind, "schema v2/v3 cannot complete a new Requirements gate", model.CurrentSchemaVersion, parsed.Envelope.SchemaVersion)
	}
	if parsed.Envelope.Workspace != input.Workspace {
		return nil, diagnostic.New("AIDD_WORKSPACE_MISMATCH", "workspace", expectedKind, "source workspace does not match the requested workspace", input.Workspace, parsed.Envelope.Workspace)
	}
	if parsed.Requirements.CycleStartIssueTitle != input.Issue.Title {
		return nil, diagnostic.New("AIDD_CYCLE_TITLE", "validation.cycle_start_issue_title", expectedKind, "cycle-start Issue title must exactly match the fetched title", input.Issue.Title, parsed.Requirements.CycleStartIssueTitle)
	}
	if err := validateIssueSnapshot(input.Issue, expectedKind); err != nil {
		return nil, err
	}
	gate := parsed.Requirements.InputGate
	expectedContext := model.TaskContext{Source: "issue_body", Issue: input.Issue.ID, URL: input.Issue.URL, UpdatedAt: input.Issue.UpdatedAt, BodySHA256: canonical.HashBytes(input.Issue.Body)}
	if gate.TaskContext != expectedContext {
		return nil, diagnostic.New("AIDD_TASK_CONTEXT", "validation.input_gate.task_context", expectedKind, "Task Context must exactly match the fetched Issue snapshot", expectedContext, gate.TaskContext)
	}
	if len(gate.DirectRules) == 0 {
		return nil, diagnostic.New("AIDD_DIRECT_RULES_EMPTY", "validation.input_gate.direct_rules", expectedKind, "Requirements must select at least one direct rule", nil, gate.DirectRules)
	}
	loadedRules, err := rules.Load(snapshot, input.RuleMapPath)
	if err != nil {
		return nil, err
	}
	directIDs := map[string]struct{}{}
	for index, selection := range gate.DirectRules {
		path := fmt.Sprintf("validation.input_gate.direct_rules[%d]", index)
		rule, exists := loadedRules.ByID[selection.ID]
		if !exists {
			return nil, diagnostic.New("AIDD_DIRECT_RULE_UNKNOWN", path+".id", expectedKind, "direct rule is absent from rule-map", nil, selection.ID)
		}
		if _, duplicate := directIDs[selection.ID]; duplicate {
			return nil, diagnostic.New("AIDD_DIRECT_RULE_DUPLICATE", path+".id", expectedKind, "direct rule IDs must be unique", "unique ID", selection.ID)
		}
		directIDs[selection.ID] = struct{}{}
		normalizedEvidence := normalizeIssueEvidence(selection.IssueEvidence)
		if normalizedEvidence == "" || !strings.Contains(normalizeIssueEvidence(string(input.Issue.Body)), normalizedEvidence) {
			return nil, diagnostic.New("AIDD_RULE_EVIDENCE", path+".issue_evidence", expectedKind, "direct rule evidence must be present in the Issue body after whitespace and case normalization", "normalized Issue substring", selection.IssueEvidence)
		}
		if strings.TrimSpace(selection.Match.Field) == "" || strings.TrimSpace(selection.Match.Value) == "" || !ruleMatches(rule, selection.Match) {
			return nil, diagnostic.New("AIDD_RULE_MATCH", path+".match", expectedKind, "direct rule match does not exist in the selected rule node", selection.Match, rule.AppliesTo)
		}
		if strings.TrimSpace(selection.Reason) == "" {
			return nil, diagnostic.New("AIDD_RULE_REASON", path+".reason", expectedKind, "direct rule reason must be non-empty", "substantive reason", selection.Reason)
		}
		if !strings.Contains(normalizedEvidence, normalizeIssueEvidence(selection.Match.Value)) {
			return nil, diagnostic.New("AIDD_RULE_MATCH_EVIDENCE", path+".match.value", expectedKind, "direct rule match value must be present in Issue evidence", selection.Match.Value, selection.IssueEvidence)
		}
		if err := validateExplicitSurface(rule, selection, normalizedEvidence, path, expectedKind); err != nil {
			return nil, err
		}
	}
	closure, err := rules.ExpandClosure(loadedRules, directIDs)
	if err != nil {
		return nil, err
	}
	for id := range directIDs {
		delete(closure, id)
	}
	declaredDependencies := map[string]struct{}{}
	for index, declared := range gate.DependsOn {
		if _, duplicate := declaredDependencies[declared.ID]; duplicate {
			return nil, diagnostic.New("AIDD_DEPENDENCY_DUPLICATE", fmt.Sprintf("validation.input_gate.depends_on[%d].id", index), expectedKind, "dependency IDs must be unique", "unique ID", declared.ID)
		}
		declaredDependencies[declared.ID] = struct{}{}
		if _, selected := closure[declared.ID]; !selected {
			return nil, diagnostic.New("AIDD_DEPENDENCY_EXTRA", fmt.Sprintf("validation.input_gate.depends_on[%d].id", index), expectedKind, "declared dependency is not in the direct-rule closure", rules.Sorted(closure), declared.ID)
		}
		if declared.Via == "" {
			return nil, diagnostic.New("AIDD_DEPENDENCY_VIA", fmt.Sprintf("validation.input_gate.depends_on[%d].via", index), expectedKind, "dependency must record a via rule", nil, declared.Via)
		}
		if _, selectedDirect := directIDs[declared.Via]; !selectedDirect {
			if _, selectedDependency := closure[declared.Via]; !selectedDependency {
				return nil, diagnostic.New("AIDD_DEPENDENCY_VIA", fmt.Sprintf("validation.input_gate.depends_on[%d].via", index), expectedKind, "dependency via must reference a selected rule", rules.Sorted(directIDs), declared.Via)
			}
		}
		viaRule := loadedRules.ByID[declared.Via]
		declaresEdge := false
		for _, child := range viaRule.DependsOn {
			if child == declared.ID {
				declaresEdge = true
				break
			}
		}
		if !declaresEdge {
			return nil, diagnostic.New("AIDD_DEPENDENCY_VIA", fmt.Sprintf("validation.input_gate.depends_on[%d].via", index), expectedKind, "dependency via must name a declared rule-map edge", declared.Via+" -> "+declared.ID, declared.Via)
		}
	}
	if !sameStringSet(closure, declaredDependencies) {
		return nil, diagnostic.New("AIDD_DEPENDENCY_CLOSURE", "validation.input_gate.depends_on", expectedKind, "declared dependencies must exactly equal the direct-rule dependency closure", rules.Sorted(closure), rules.Sorted(declaredDependencies))
	}
	completeness := parsed.Requirements.CompletenessGate
	if completeness.IssueBodySHA256 != expectedContext.BodySHA256 || completeness.Workspace != input.Workspace {
		return nil, diagnostic.New("AIDD_COMPLETENESS_IDENTITY", "validation.completeness_gate", expectedKind, "completeness gate must match Issue body and workspace", map[string]string{"issue_body_sha256": expectedContext.BodySHA256, "workspace": input.Workspace}, completeness)
	}
	requirementIDs := make([]string, len(parsed.Requirements.Requirements))
	for index, requirement := range parsed.Requirements.Requirements {
		requirementIDs[index] = requirement.ID
	}
	transitionIDs := make([]string, len(completeness.Requirements))
	for index, item := range completeness.Requirements {
		transitionIDs[index] = item.ID
		if err := validateTransition(item, string(input.Issue.Body), expectedKind); err != nil {
			return nil, err
		}
	}
	if !equalStrings(requirementIDs, transitionIDs) {
		return nil, diagnostic.New("AIDD_REQUIREMENT_TRANSITIONS", "validation.completeness_gate.requirements", expectedKind, "Requirement transition inventory must match source Requirements", requirementIDs, transitionIDs)
	}
	if err := validateRequirementsCompleteness(parsed, completeness, sectionContract, string(input.Issue.Body), expectedKind); err != nil {
		return nil, err
	}
	baselineBytes, err := validateArtifactBaseline(ctx, snapshot, input.Workspace, "requirements.json", completeness.Baseline, expectedKind, "AIDD_REQUIREMENTS_BASELINE")
	if err != nil {
		return nil, err
	}
	if err := validateRequirementsBaselineContinuity(parsed, completeness, sectionContract, baselineBytes, expectedKind); err != nil {
		return nil, err
	}
	if expectedKind == "requirements" && !input.SkipGoalComparison {
		if len(input.Goal) == 0 {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_GOAL", "goal_document", expectedKind, "Requirements artifact validation requires the retained Goal", nil, nil)
		}
		goal, goalErr := semantic.ParseSource(input.Goal, "requirements_goal", "requirements_goal")
		if goalErr != nil {
			return nil, goalErr
		}
		if goal.ReadOnlyLegacy || goal.Envelope.Workspace != input.Workspace || goal.Requirements.CycleStartIssueTitle != input.Issue.Title {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_GOAL", "goal_document", expectedKind, "retained Requirements Goal must use current schema and the same cycle identity", input.Workspace, goal.Envelope)
		}
		if _, _, err := validateRequirementsSections(goal.Requirements.Sections, sectionContract, "requirements_goal"); err != nil {
			return nil, err
		}
		if !equalJSON(goal.Requirements.InputGate, parsed.Requirements.InputGate) || !equalJSON(goal.Requirements.CompletenessGate, parsed.Requirements.CompletenessGate) || !equalRequirementDefinitions(goal.Requirements.Requirements, parsed.Requirements.Requirements) {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_GOAL_DRIFT", "validation", expectedKind, "Requirements artifact gate and inventory must match the retained Goal", goal.Requirements, parsed.Requirements)
		}
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, err
	}
	return parsed, nil
}

func equalRequirementDefinitions(goal, artifact []model.Requirement) bool {
	if len(goal) != len(artifact) {
		return false
	}
	for index := range goal {
		if goal[index].ID != artifact[index].ID || goal[index].Text != artifact[index].Text {
			return false
		}
	}
	return true
}

func validateRequirementsCompleteness(parsed *semantic.ParsedSource, gate model.RequirementsCompletenessGate, sectionContract *requirementscontract.Resolved, issueBody, artifact string) error {
	sectionIDs := make([]string, len(gate.Sections))
	for index, item := range gate.Sections {
		sectionIDs[index] = item.ID
	}
	if !equalStrings(sectionIDs, sectionContract.IDs) {
		return diagnostic.New(
			"AIDD_SECTION_TRANSITIONS",
			"validation.completeness_gate.sections",
			artifact,
			"section transition inventory must contain every canonical Requirements section in order",
			sectionContract.IDs,
			sectionIDs,
		)
	}

	requirementsByID := make(map[string]model.Requirement, len(parsed.Requirements.Requirements))
	requirementContents := make(map[string]string, len(parsed.Requirements.Requirements))
	for _, requirement := range parsed.Requirements.Requirements {
		requirementsByID[requirement.ID] = requirement
		requirementContents[requirement.ID] = requirement.Text
	}
	if err := validateOwnedTransitions(gate.Requirements, issueBody, requirementContents, artifact, "Requirement"); err != nil {
		return err
	}
	sectionContents := requirementsSectionContents(parsed.Requirements.Sections, parsed.Requirements.Requirements)
	if err := validateOwnedTransitions(gate.Sections, issueBody, sectionContents, artifact, "section"); err != nil {
		return err
	}

	retiredIDs := map[string]struct{}{}
	for index, item := range gate.Retired {
		path := fmt.Sprintf("validation.completeness_gate.retired[%d]", index)
		if !requirementIDPattern.MatchString(item.ID) {
			return diagnostic.New("AIDD_RETIRED_ID", path+".id", artifact, "retired Requirement ID is invalid", "FR/NFR/AC-number", item.ID)
		}
		if _, duplicate := retiredIDs[item.ID]; duplicate {
			return diagnostic.New("AIDD_RETIRED_DUPLICATE", path+".id", artifact, "retired Requirement IDs must be unique", "unique ID", item.ID)
		}
		if _, current := requirementsByID[item.ID]; current {
			return diagnostic.New("AIDD_RETIRED_CURRENT", path+".id", artifact, "a retired Requirement must not remain in the current inventory", "absent current Requirement", item.ID)
		}
		if err := validateRetirementEvidence(item, issueBody, path, artifact); err != nil {
			return err
		}
		retiredIDs[item.ID] = struct{}{}
	}

	_, _, err := validateRequirementsSections(parsed.Requirements.Sections, sectionContract, artifact)
	return err
}

func validateRequirementsBaselineContinuity(parsed *semantic.ParsedSource, gate model.RequirementsCompletenessGate, sectionContract *requirementscontract.Resolved, baselineBytes []byte, artifact string) error {
	currentRequirements := make(map[string]model.Requirement, len(parsed.Requirements.Requirements))
	for _, requirement := range parsed.Requirements.Requirements {
		currentRequirements[requirement.ID] = requirement
	}
	currentSections := map[string]model.Section{}
	sections, _, err := validateRequirementsSections(parsed.Requirements.Sections, sectionContract, artifact)
	if err != nil {
		return err
	}
	for _, section := range sections {
		currentSections[section.ID] = section
	}

	if baselineBytes == nil {
		if len(gate.Retired) != 0 {
			return diagnostic.New("AIDD_RETIRED_BASELINE", "validation.completeness_gate.retired", artifact, "retired Requirements require a Git HEAD baseline", []model.RequirementRetirement{}, gate.Retired)
		}
		for _, item := range append(append([]model.RequirementTransition{}, gate.Requirements...), gate.Sections...) {
			if item.Status != "new" {
				return diagnostic.New("AIDD_TRANSITION_BASELINE", item.ID, artifact, "records without a Git HEAD baseline must be classified as new", "new", item.Status)
			}
		}
		return nil
	}

	baselineRequirements, baselineSections, err := extractRequirementsBaseline(baselineBytes, sectionContract)
	if err != nil {
		return err
	}
	for _, item := range gate.Requirements {
		previous, existed := baselineRequirements[item.ID]
		if item.Status == "new" && existed {
			return diagnostic.New("AIDD_TRANSITION_BASELINE", item.ID, artifact, "new Requirement already exists in Git HEAD", "absent baseline", item.Status)
		}
		if item.Status != "new" && !existed {
			return diagnostic.New("AIDD_TRANSITION_BASELINE", item.ID, artifact, "changed or unchanged Requirement must exist in Git HEAD", "existing baseline", item.Status)
		}
		if existed {
			unchanged := normalizeNewlines(previous.Text) == normalizeNewlines(currentRequirements[item.ID].Text)
			if item.Status == "unchanged" && !unchanged {
				return diagnostic.New("AIDD_TRANSITION_CONTENT", item.ID, artifact, "unchanged Requirement content differs from Git HEAD", previous.Text, currentRequirements[item.ID].Text)
			}
			if item.Status == "changed" && unchanged {
				return diagnostic.New("AIDD_TRANSITION_CONTENT", item.ID, artifact, "changed Requirement content is identical to Git HEAD", "different content", currentRequirements[item.ID].Text)
			}
		}
	}
	expectedRetired := []string{}
	for _, requirement := range baselineRequirements {
		if _, exists := currentRequirements[requirement.ID]; !exists {
			expectedRetired = append(expectedRetired, requirement.ID)
		}
	}
	sort.Slice(expectedRetired, func(i, j int) bool {
		return requirementSortKey(expectedRetired[i]) < requirementSortKey(expectedRetired[j])
	})
	actualRetired := make([]string, len(gate.Retired))
	for index, item := range gate.Retired {
		actualRetired[index] = item.ID
	}
	if !equalStrings(actualRetired, expectedRetired) {
		return diagnostic.New("AIDD_RETIRED_INVENTORY", "validation.completeness_gate.retired", artifact, "retired inventory must exactly contain baseline Requirements absent from the current source", expectedRetired, actualRetired)
	}

	for _, item := range gate.Sections {
		previous, existed := baselineSections[item.ID]
		if item.Status == "new" && existed {
			return diagnostic.New("AIDD_SECTION_TRANSITION_BASELINE", item.ID, artifact, "new section already exists in Git HEAD", "absent baseline", item.Status)
		}
		if item.Status != "new" && !existed {
			return diagnostic.New("AIDD_SECTION_TRANSITION_BASELINE", item.ID, artifact, "changed or unchanged section must exist in Git HEAD", "existing baseline", item.Status)
		}
		if existed {
			previousHash, hashErr := requirementsSectionHash(previous, baselineRequirements)
			if hashErr != nil {
				return hashErr
			}
			currentHash, hashErr := requirementsSectionHash(currentSections[item.ID], currentRequirements)
			if hashErr != nil {
				return hashErr
			}
			if item.Status == "unchanged" && currentHash != previousHash {
				return diagnostic.New("AIDD_SECTION_TRANSITION_CONTENT", item.ID, artifact, "unchanged section differs from Git HEAD", previousHash, currentHash)
			}
			if item.Status == "changed" && currentHash == previousHash {
				return diagnostic.New("AIDD_SECTION_TRANSITION_CONTENT", item.ID, artifact, "changed section is identical to Git HEAD", "different content hash", currentHash)
			}
		}
	}
	return nil
}

func extractRequirementsBaseline(content []byte, sectionContract *requirementscontract.Resolved) (map[string]model.Requirement, map[string]model.Section, error) {
	var source model.Source
	if err := canonical.Decode(content, "git_head_requirements", &source); err != nil {
		return nil, nil, err
	}
	if source.Kind != "requirements" {
		return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_KIND", "kind", "git_head_requirements", "Git HEAD Requirements baseline kind is invalid", "requirements", source.Kind)
	}
	var validation struct {
		Requirements []json.RawMessage `json:"requirements"`
		Sections     json.RawMessage   `json:"sections"`
	}
	if err := json.Unmarshal(source.Validation, &validation); err != nil {
		return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_SOURCE", "validation", "git_head_requirements", "Git HEAD Requirements baseline is invalid", "requirements source", err.Error())
	}
	requirements := make(map[string]model.Requirement, len(validation.Requirements))
	requirementList := make([]model.Requirement, 0, len(validation.Requirements))
	for index, rawRequirement := range validation.Requirements {
		var requirement struct {
			ID        string `json:"id"`
			SectionID string `json:"section_id"`
			Text      string `json:"text"`
		}
		path := fmt.Sprintf("validation.requirements[%d]", index)
		if err := canonical.Decode(rawRequirement, "git_head_requirements."+path, &requirement); err != nil {
			return nil, nil, err
		}
		if !requirementIDPattern.MatchString(requirement.ID) {
			return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_ID", path+".id", "git_head_requirements", "Git HEAD Requirement ID is invalid", "FR/NFR/AC-number", requirement.ID)
		}
		if _, duplicate := requirements[requirement.ID]; duplicate {
			return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_DUPLICATE", path+".id", "git_head_requirements", "Git HEAD Requirement IDs must be unique", "unique ID", requirement.ID)
		}
		decoded := model.Requirement{ID: requirement.ID, SectionID: requirement.SectionID, Text: requirement.Text}
		requirements[requirement.ID] = decoded
		requirementList = append(requirementList, decoded)
	}
	decodedSections, err := semantic.DecodeSections(validation.Sections, true, "git_head_requirements")
	if err != nil {
		return nil, nil, err
	}
	sections, _, err := validateRequirementsSections(decodedSections, sectionContract, "git_head_requirements")
	if err != nil {
		return nil, nil, err
	}
	if err := semantic.ValidateRequirementsStructure(requirementList, sections, "git_head_requirements"); err != nil {
		return nil, nil, err
	}
	sectionsByID := make(map[string]model.Section, len(sections))
	for _, section := range sections {
		sectionsByID[section.ID] = section
	}
	return requirements, sectionsByID, nil
}

func requirementSortKey(value string) int {
	parts := strings.Split(value, "-")
	if len(parts) != 2 {
		return 1 << 30
	}
	weights := map[string]int{"FR": 0, "NFR": 1, "AC": 2}
	var number int
	if _, err := fmt.Sscanf(parts[1], "%d", &number); err != nil {
		return 1 << 30
	}
	return weights[parts[0]]*1_000_000 + number
}

func normalizeNewlines(value string) string {
	return strings.ReplaceAll(value, "\r\n", "\n")
}

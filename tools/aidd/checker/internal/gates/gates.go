package gates

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/requirementscontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

type IssueSnapshot struct {
	ID        string
	Title     string
	URL       string
	UpdatedAt string
	Body      []byte
}

type RequirementsInput struct {
	Issue              IssueSnapshot
	Workspace          string
	Kind               string
	Document           []byte
	Goal               []byte
	RuleMapPath        string
	SkipGoalComparison bool
}

type taskContext struct {
	Source     string `json:"source"`
	Issue      string `json:"issue"`
	URL        string `json:"url"`
	UpdatedAt  string `json:"updated_at"`
	BodySHA256 string `json:"body_sha256"`
}

type directRule struct {
	ID              string `json:"id"`
	IssueEvidence   string `json:"issue_evidence"`
	Match           match  `json:"match"`
	Reason          string `json:"reason"`
	ExplicitSurface string `json:"explicit_surface,omitempty"`
}

type match struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

type dependency struct {
	ID  string `json:"id"`
	Via string `json:"via"`
}

type inputGate struct {
	TaskContext taskContext  `json:"task_context"`
	DirectRules []directRule `json:"direct_rules"`
	DependsOn   []dependency `json:"depends_on"`
}

type transition struct {
	ID            string  `json:"id"`
	Status        string  `json:"status"`
	IssueEvidence *string `json:"issue_evidence"`
}

type retirement struct {
	ID            string `json:"id"`
	IssueEvidence string `json:"issue_evidence"`
}

type baseline struct {
	Source     string  `json:"source"`
	BodySHA256 *string `json:"body_sha256"`
}

type completenessGate struct {
	IssueBodySHA256 string       `json:"issue_body_sha256"`
	Workspace       string       `json:"workspace"`
	Baseline        baseline     `json:"baseline"`
	Requirements    []transition `json:"requirements"`
	Sections        []transition `json:"sections"`
	Retired         []retirement `json:"retired"`
}

type sourceSection struct {
	ID      string        `json:"id"`
	Heading string        `json:"heading"`
	Blocks  []sourceBlock `json:"blocks"`
}

type sourceBlock struct {
	ID                 string   `json:"id"`
	Type               string   `json:"type"`
	Markdown           string   `json:"markdown,omitempty"`
	Role               string   `json:"role,omitempty"`
	OwnerID            string   `json:"owner_id,omitempty"`
	Text               string   `json:"text,omitempty"`
	ProductBehaviorIDs []string `json:"product_behavior_ids,omitempty"`
}

type coverageEntry struct {
	ID                  string `json:"id"`
	DesignBlockID       string `json:"design_block_id"`
	VerificationBlockID string `json:"verification_block_id"`
}

type baselineSection struct {
	SectionID     *string `json:"section_id"`
	Heading       string  `json:"heading"`
	ContentSHA256 string  `json:"content_sha256"`
	Status        string  `json:"status"`
	DesignBlockID string  `json:"design_block_id,omitempty"`
}

var (
	lowerKebabPattern    = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	requirementIDPattern = regexp.MustCompile(`^(?:FR|NFR|AC)-[1-9][0-9]*$`)
	sha256Pattern        = regexp.MustCompile(`^[0-9a-f]{64}$`)
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
	var gate inputGate
	if err := canonical.Decode(parsed.Requirements.InputGate, expectedKind+".input_gate", &gate); err != nil {
		return nil, err
	}
	expectedContext := taskContext{Source: "issue_body", Issue: input.Issue.ID, URL: input.Issue.URL, UpdatedAt: input.Issue.UpdatedAt, BodySHA256: canonical.HashBytes(input.Issue.Body)}
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
		if selection.IssueEvidence == "" || !strings.Contains(string(input.Issue.Body), selection.IssueEvidence) {
			return nil, diagnostic.New("AIDD_RULE_EVIDENCE", path+".issue_evidence", expectedKind, "direct rule evidence must be a literal substring of the Issue body", "Issue substring", selection.IssueEvidence)
		}
		if !ruleMatches(rule, selection.Match) {
			return nil, diagnostic.New("AIDD_RULE_MATCH", path+".match", expectedKind, "direct rule match does not exist in the selected rule node", selection.Match, rule.AppliesTo)
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
	}
	if !sameStringSet(closure, declaredDependencies) {
		return nil, diagnostic.New("AIDD_DEPENDENCY_CLOSURE", "validation.input_gate.depends_on", expectedKind, "declared dependencies must exactly equal the direct-rule dependency closure", rules.Sorted(closure), rules.Sorted(declaredDependencies))
	}
	var completeness completenessGate
	if err := canonical.Decode(parsed.Requirements.CompletenessGate, expectedKind+".completeness_gate", &completeness); err != nil {
		return nil, err
	}
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
		if !equalJSON(goal.Requirements.InputGate, parsed.Requirements.InputGate) || !equalJSON(goal.Requirements.CompletenessGate, parsed.Requirements.CompletenessGate) || !equalJSON(goal.Requirements.Requirements, parsed.Requirements.Requirements) {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_GOAL_DRIFT", "validation", expectedKind, "Requirements artifact gate and inventory must match the retained Goal", goal.Requirements, parsed.Requirements)
		}
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, err
	}
	return parsed, nil
}

type DesignInput struct {
	Issue        IssueSnapshot
	Workspace    string
	Kind         string
	Requirements []byte
	Document     []byte
	Goal         []byte
	RuleMapPath  string
	ProfilePath  string
}

type DesignResult struct {
	Requirements *semantic.ParsedSource
	Document     *semantic.ParsedSource
	Goal         *semantic.ParsedSource
	Catalog      *catalog.Resolved
	Rules        *rules.Loaded
}

type designCoverageGate struct {
	RequirementsSHA256 string            `json:"requirements_sha256"`
	Workspace          string            `json:"workspace"`
	RequirementIDs     []string          `json:"requirement_ids"`
	Baseline           baseline          `json:"baseline"`
	Coverage           []coverageEntry   `json:"coverage"`
	BaselineSections   []baselineSection `json:"baseline_sections"`
}

func ValidateDesign(ctx context.Context, snapshot *repository.Snapshot, input DesignInput) (*DesignResult, error) {
	if input.Kind != "design" && input.Kind != "design_goal" {
		return nil, diagnostic.New("AIDD_DESIGN_KIND", "kind", "design_gate", "Design gate kind is unsupported", []string{"design", "design_goal"}, input.Kind)
	}
	preparsedRequirements, err := semantic.ParseSource(input.Requirements, "requirements", "requirements")
	if err != nil {
		return nil, err
	}
	if preparsedRequirements.ReadOnlyLegacy || preparsedRequirements.Envelope.Workspace != input.Workspace || (input.Issue.Title != "" && preparsedRequirements.Requirements.CycleStartIssueTitle != input.Issue.Title) {
		return nil, diagnostic.New("AIDD_DESIGN_REQUIREMENTS", "requirements", input.Kind, "Design requires current schema v4 canonical Requirements for the same cycle", input.Workspace, preparsedRequirements.Envelope)
	}
	issue := input.Issue
	if issue.Title == "" {
		issue.Title = preparsedRequirements.Requirements.CycleStartIssueTitle
	}
	requirements, err := ValidateRequirements(ctx, snapshot, RequirementsInput{
		Issue: issue, Workspace: input.Workspace, Kind: "requirements", Document: input.Requirements,
		RuleMapPath: input.RuleMapPath, SkipGoalComparison: true,
	})
	if err != nil {
		return nil, err
	}
	parsed, err := semantic.ParseSource(input.Document, input.Kind, input.Kind)
	if err != nil {
		return nil, err
	}
	if parsed.ReadOnlyLegacy || parsed.Envelope.Workspace != input.Workspace {
		return nil, diagnostic.New("AIDD_DESIGN_WORKSPACE", "workspace", input.Kind, "Design source must use current schema and requested workspace", input.Workspace, parsed.Envelope)
	}
	var gate designCoverageGate
	if err := canonical.Decode(parsed.Design.CoverageGate, input.Kind+".coverage_gate", &gate); err != nil {
		return nil, err
	}
	requirementIDs := make([]string, len(requirements.Requirements.Requirements))
	for index, requirement := range requirements.Requirements.Requirements {
		requirementIDs[index] = requirement.ID
	}
	if gate.RequirementsSHA256 != canonical.HashBytes(input.Requirements) || gate.Workspace != input.Workspace || !equalStrings(gate.RequirementIDs, requirementIDs) {
		return nil, diagnostic.New("AIDD_DESIGN_COVERAGE_IDENTITY", "validation.coverage_gate", input.Kind, "Design coverage gate must match canonical Requirements bytes, workspace, and full Requirement inventory", map[string]any{"requirements_sha256": canonical.HashBytes(input.Requirements), "workspace": input.Workspace, "requirement_ids": requirementIDs}, gate)
	}
	if err := validateDesignCoverage(ctx, snapshot, parsed, gate, input.Workspace, input.Kind); err != nil {
		return nil, err
	}
	if err := semantic.ValidateTargetState(&parsed.Design.TargetState, requirementIDs, input.Kind); err != nil {
		return nil, err
	}
	resolvedCatalog, err := catalog.Load(snapshot, input.ProfilePath)
	if err != nil {
		return nil, err
	}
	if _, err := semantic.ValidateProfiles(&parsed.Design.TargetState, resolvedCatalog, input.Kind); err != nil {
		return nil, err
	}
	if err := validateObservablePaths(ctx, snapshot, &parsed.Design.TargetState, input.Kind); err != nil {
		return nil, err
	}
	loadedRules, err := rules.Load(snapshot, input.RuleMapPath)
	if err != nil {
		return nil, err
	}
	if err := validateDesignRuleCoverage(snapshot, parsed, requirements, loadedRules); err != nil {
		return nil, err
	}
	var goal *semantic.ParsedSource
	if input.Kind == "design" {
		if len(input.Goal) == 0 {
			return nil, diagnostic.New("AIDD_DESIGN_GOAL", "goal_document", input.Kind, "Design artifact validation requires the retained Goal", nil, nil)
		}
		parsedGoal, goalErr := semantic.ParseSource(input.Goal, "design_goal", "design_goal")
		if goalErr != nil {
			return nil, goalErr
		}
		goal = parsedGoal
		if goal.ReadOnlyLegacy || goal.Envelope.Workspace != input.Workspace {
			return nil, diagnostic.New("AIDD_DESIGN_GOAL", "goal_document", input.Kind, "retained Design Goal must use current schema and the same workspace", input.Workspace, goal.Envelope)
		}
		if !equalJSON(goal.Design.TargetState, parsed.Design.TargetState) || !equalJSON(goal.Design.RuleCoverage, parsed.Design.RuleCoverage) || !equalJSON(goal.Design.CoverageGate, parsed.Design.CoverageGate) {
			return nil, diagnostic.New("AIDD_DESIGN_GOAL_DRIFT", "validation", input.Kind, "Design artifact target state and rule coverage must match the retained Goal", goal.Design, parsed.Design)
		}
	}
	if err := snapshot.AssertUnchanged(); err != nil {
		return nil, err
	}
	return &DesignResult{Requirements: requirements, Document: parsed, Goal: goal, Catalog: resolvedCatalog, Rules: loadedRules}, nil
}

func validateObservablePaths(ctx context.Context, snapshot *repository.Snapshot, target *model.TargetState, artifact string) error {
	paths := map[string]struct{}{}
	for _, scope := range target.OwnershipScopes {
		paths[scope.Path] = struct{}{}
	}
	for _, representation := range target.Representations {
		paths[representation.Path] = struct{}{}
	}
	inventory, err := state.Inventory(snapshot, target)
	if err != nil {
		return err
	}
	for _, path := range inventory {
		paths[path] = struct{}{}
	}
	ignored, err := snapshot.Ignored(ctx, rules.Sorted(paths))
	if err != nil {
		return err
	}
	if len(ignored) > 0 {
		return diagnostic.New("AIDD_OWNERSHIP_IGNORED", ignored[0], artifact, "ownership and representation paths must be observable by Git", "not ignored", ignored)
	}
	return nil
}

func validateDesignRuleCoverage(snapshot *repository.Snapshot, design, requirements *semantic.ParsedSource, loadedRules *rules.Loaded) error {
	paths, err := state.Inventory(snapshot, &design.Design.TargetState)
	if err != nil {
		return err
	}
	pathSet := map[string]struct{}{}
	for _, path := range paths {
		pathSet[path] = struct{}{}
	}
	for _, representation := range design.Design.TargetState.Representations {
		pathSet[representation.Path] = struct{}{}
	}
	orderedPaths := rules.Sorted(pathSet)
	declaredSurfaces := design.Design.RuleCoverage.ImplementationSurfaces
	expectedSurfacesSet := map[string]struct{}{}
	for _, path := range orderedPaths {
		surfaces, _, resolveErr := rules.ResolvePath(loadedRules, path)
		if resolveErr != nil {
			return resolveErr
		}
		for _, surface := range surfaces {
			expectedSurfacesSet[surface] = struct{}{}
		}
	}
	expectedSurfaces := []string{}
	for _, surface := range loadedRules.Map.ReviewRouting.Surfaces {
		if _, ok := expectedSurfacesSet[surface.ID]; ok {
			expectedSurfaces = append(expectedSurfaces, surface.ID)
		}
	}
	if !equalStrings(declaredSurfaces, expectedSurfaces) {
		return diagnostic.New("AIDD_DESIGN_SURFACES", "validation.rule_coverage.implementation_surfaces", design.Envelope.Kind, "implementation surfaces must exactly match baseline and target paths", expectedSurfaces, declaredSurfaces)
	}
	selectedDirect := map[string]struct{}{}
	var input inputGate
	_ = json.Unmarshal(requirements.Requirements.InputGate, &input)
	for _, direct := range input.DirectRules {
		selectedDirect[direct.ID] = struct{}{}
	}
	for _, dependency := range input.DependsOn {
		selectedDirect[dependency.ID] = struct{}{}
	}
	for _, surfaceID := range declaredSurfaces {
		for _, surface := range loadedRules.Map.ReviewRouting.Surfaces {
			if surface.ID == surfaceID {
				for _, ruleID := range surface.RequiredRules {
					selectedDirect[ruleID] = struct{}{}
				}
			}
		}
	}
	for _, additional := range design.Design.RuleCoverage.AdditionalRules {
		selectedDirect[additional.ID] = struct{}{}
	}
	selectedClosure, err := rules.ExpandClosure(loadedRules, selectedDirect)
	if err != nil {
		return err
	}
	for _, path := range orderedPaths {
		_, required, resolveErr := rules.ResolvePath(loadedRules, path)
		if resolveErr != nil {
			return resolveErr
		}
		for _, ruleID := range required {
			if _, ok := selectedClosure[ruleID]; !ok {
				return diagnostic.New("AIDD_DESIGN_PATH_RULE", path, design.Envelope.Kind, "Design rule coverage omits a path-required rule", rules.Sorted(selectedClosure), ruleID)
			}
		}
	}
	return nil
}

func validateRequirementsCompleteness(parsed *semantic.ParsedSource, gate completenessGate, sectionContract *requirementscontract.Resolved, issueBody, artifact string) error {
	sectionIDs := make([]string, len(gate.Sections))
	for index, item := range gate.Sections {
		sectionIDs[index] = item.ID
		if err := validateTransition(item, issueBody, artifact); err != nil {
			return err
		}
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
	for _, requirement := range parsed.Requirements.Requirements {
		requirementsByID[requirement.ID] = requirement
	}
	for _, item := range gate.Requirements {
		if item.IssueEvidence != nil && !strings.Contains(requirementsByID[item.ID].Text, *item.IssueEvidence) {
			return diagnostic.New("AIDD_REQUIREMENT_EVIDENCE_OWNER", item.ID, artifact, "Requirement transition evidence must occur in its owned Requirement text", requirementsByID[item.ID].Text, *item.IssueEvidence)
		}
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
		if strings.TrimSpace(item.IssueEvidence) == "" || !strings.Contains(issueBody, item.IssueEvidence) {
			return diagnostic.New("AIDD_RETIRED_EVIDENCE", path+".issue_evidence", artifact, "retirement evidence must be a literal substring of the Issue body", "Issue substring", item.IssueEvidence)
		}
		retiredIDs[item.ID] = struct{}{}
	}

	sections, _, err := validateRequirementsSections(parsed.Requirements.Sections, sectionContract, artifact)
	if err != nil {
		return err
	}
	actualSectionIDs := make([]string, len(sections))
	sectionSet := make(map[string]struct{}, len(sections))
	requirementBlockCounts := make(map[string]int, len(sections))
	for index, section := range sections {
		actualSectionIDs[index] = section.ID
		sectionSet[section.ID] = struct{}{}
		for _, block := range section.Blocks {
			if block.Type == "requirements" {
				requirementBlockCounts[section.ID]++
			}
		}
	}
	requirementsPerSection := make(map[string]int, len(sections))
	for index, requirement := range parsed.Requirements.Requirements {
		if _, exists := sectionSet[requirement.SectionID]; !exists {
			return diagnostic.New("AIDD_REQUIREMENT_SECTION", fmt.Sprintf("validation.requirements[%d].section_id", index), artifact, "Requirement section_id must reference a current section", actualSectionIDs, requirement.SectionID)
		}
		requirementsPerSection[requirement.SectionID]++
	}
	for _, section := range sections {
		expected := 0
		if requirementsPerSection[section.ID] > 0 {
			expected = 1
		}
		if requirementBlockCounts[section.ID] != expected {
			return diagnostic.New("AIDD_REQUIREMENTS_BLOCK", "validation.sections."+section.ID, artifact, "each Requirements-owning section must contain exactly one requirements block", expected, requirementBlockCounts[section.ID])
		}
	}
	return nil
}

func validateRequirementsBaselineContinuity(parsed *semantic.ParsedSource, gate completenessGate, sectionContract *requirementscontract.Resolved, baselineBytes []byte, artifact string) error {
	currentRequirements := make(map[string]model.Requirement, len(parsed.Requirements.Requirements))
	for _, requirement := range parsed.Requirements.Requirements {
		currentRequirements[requirement.ID] = requirement
	}
	currentSections := map[string]sourceSection{}
	sections, _, err := validateRequirementsSections(parsed.Requirements.Sections, sectionContract, artifact)
	if err != nil {
		return err
	}
	for _, section := range sections {
		currentSections[section.ID] = section
	}

	if baselineBytes == nil {
		if len(gate.Retired) != 0 {
			return diagnostic.New("AIDD_RETIRED_BASELINE", "validation.completeness_gate.retired", artifact, "retired Requirements require a Git HEAD baseline", []retirement{}, gate.Retired)
		}
		for _, item := range append(append([]transition{}, gate.Requirements...), gate.Sections...) {
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
			previousHash, hashErr := canonical.Hash(previous)
			if hashErr != nil {
				return hashErr
			}
			currentHash, hashErr := canonical.Hash(currentSections[item.ID])
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

func extractRequirementsBaseline(content []byte, sectionContract *requirementscontract.Resolved) (map[string]model.Requirement, map[string]sourceSection, error) {
	var source struct {
		Kind       string `json:"kind"`
		Validation struct {
			Requirements []model.Requirement `json:"requirements"`
			Sections     json.RawMessage     `json:"sections"`
		} `json:"validation"`
	}
	if err := json.Unmarshal(content, &source); err != nil {
		return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_SOURCE", "validation", "git_head_requirements", "Git HEAD Requirements baseline is invalid", "requirements source", err.Error())
	}
	if source.Kind != "requirements" {
		return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_KIND", "kind", "git_head_requirements", "Git HEAD Requirements baseline kind is invalid", "requirements", source.Kind)
	}
	requirements := make(map[string]model.Requirement, len(source.Validation.Requirements))
	for index, requirement := range source.Validation.Requirements {
		if !requirementIDPattern.MatchString(requirement.ID) {
			return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_ID", fmt.Sprintf("validation.requirements[%d].id", index), "git_head_requirements", "Git HEAD Requirement ID is invalid", "FR/NFR/AC-number", requirement.ID)
		}
		if _, duplicate := requirements[requirement.ID]; duplicate {
			return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BASELINE_DUPLICATE", fmt.Sprintf("validation.requirements[%d].id", index), "git_head_requirements", "Git HEAD Requirement IDs must be unique", "unique ID", requirement.ID)
		}
		requirements[requirement.ID] = requirement
	}
	sections, _, err := validateRequirementsSections(source.Validation.Sections, sectionContract, "git_head_requirements")
	if err != nil {
		return nil, nil, err
	}
	sectionsByID := make(map[string]sourceSection, len(sections))
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

func validateDesignCoverage(ctx context.Context, snapshot *repository.Snapshot, parsed *semantic.ParsedSource, gate designCoverageGate, workspace, artifact string) error {
	sections, blocks, err := validateSourceSections(parsed.Design.Sections, false, artifact)
	if err != nil {
		return err
	}
	coverageIDs := make([]string, len(gate.Coverage))
	references := map[string]struct{}{}
	for index, entry := range gate.Coverage {
		path := fmt.Sprintf("validation.coverage_gate.coverage[%d]", index)
		coverageIDs[index] = entry.ID
		if entry.DesignBlockID == entry.VerificationBlockID {
			return diagnostic.New("AIDD_COVERAGE_REFERENCE", path, artifact, "design and verification evidence block IDs must differ", "distinct block IDs", entry.DesignBlockID)
		}
		for _, expected := range []struct {
			field string
			id    string
			role  string
		}{{field: "design_block_id", id: entry.DesignBlockID, role: "design"}, {field: "verification_block_id", id: entry.VerificationBlockID, role: "verification"}} {
			block, exists := blocks[expected.id]
			if !exists || block.Type != "evidence" || block.Role != expected.role || block.OwnerID != entry.ID {
				return diagnostic.New("AIDD_COVERAGE_EVIDENCE", path+"."+expected.field, artifact, "coverage must reference evidence with the required role and Requirement owner", map[string]string{"type": "evidence", "role": expected.role, "owner_id": entry.ID}, block)
			}
			if _, duplicate := references[expected.id]; duplicate {
				return diagnostic.New("AIDD_COVERAGE_DUPLICATE_REFERENCE", path+"."+expected.field, artifact, "coverage evidence block references must be unique", "unique block ID", expected.id)
			}
			references[expected.id] = struct{}{}
		}
		if normalizeEvidence(blocks[entry.DesignBlockID].Text) == normalizeEvidence(blocks[entry.VerificationBlockID].Text) {
			return diagnostic.New("AIDD_COVERAGE_EVIDENCE_DUPLICATE", path, artifact, "design and verification evidence must be distinct", "different substantive text", blocks[entry.DesignBlockID].Text)
		}
	}
	if !equalStrings(coverageIDs, gate.RequirementIDs) {
		return diagnostic.New("AIDD_COVERAGE_INVENTORY", "validation.coverage_gate.coverage", artifact, "coverage must contain every Requirement ID in canonical order", gate.RequirementIDs, coverageIDs)
	}

	baselineBytes, err := validateArtifactBaseline(ctx, snapshot, workspace, "design-doc.json", gate.Baseline, artifact, "AIDD_DESIGN_BASELINE")
	if err != nil {
		return err
	}
	if baselineBytes == nil {
		if len(gate.BaselineSections) != 0 {
			return diagnostic.New("AIDD_BASELINE_SECTIONS", "validation.coverage_gate.baseline_sections", artifact, "baseline_sections must be empty when Git HEAD has no Design baseline", []baselineSection{}, gate.BaselineSections)
		}
		return nil
	}
	baselineRaw, err := extractSourceSections(baselineBytes, "design", "git_head_design")
	if err != nil {
		return err
	}
	baselineSections, _, err := validateSourceSections(baselineRaw, false, "git_head_design")
	if err != nil {
		return err
	}
	if len(gate.BaselineSections) != len(baselineSections) {
		return diagnostic.New("AIDD_BASELINE_SECTIONS", "validation.coverage_gate.baseline_sections", artifact, "baseline_sections must classify every Git HEAD Design section", len(baselineSections), len(gate.BaselineSections))
	}
	currentByID := make(map[string]sourceSection, len(sections))
	for _, section := range sections {
		currentByID[section.ID] = section
	}
	for index, baselineSource := range baselineSections {
		entry := gate.BaselineSections[index]
		path := fmt.Sprintf("validation.coverage_gate.baseline_sections[%d]", index)
		digest, hashErr := canonical.Hash(baselineSource)
		if hashErr != nil {
			return hashErr
		}
		if entry.SectionID == nil || *entry.SectionID != baselineSource.ID || entry.Heading != baselineSource.Heading || entry.ContentSHA256 != digest {
			return diagnostic.New("AIDD_BASELINE_SECTION_IDENTITY", path, artifact, "baseline section identity must exactly match Git HEAD", map[string]any{"section_id": baselineSource.ID, "heading": baselineSource.Heading, "content_sha256": digest}, entry)
		}
		current, present := currentByID[baselineSource.ID]
		currentDigest := ""
		if present {
			currentDigest, hashErr = canonical.Hash(current)
			if hashErr != nil {
				return hashErr
			}
		}
		switch entry.Status {
		case "preserved":
			if entry.DesignBlockID != "" || !present || currentDigest != digest {
				return diagnostic.New("AIDD_BASELINE_PRESERVED", path, artifact, "preserved baseline section must remain byte-semantically unchanged and own no replacement evidence", digest, entry)
			}
		case "replaced":
			if entry.DesignBlockID == "" || (present && currentDigest == digest) {
				return diagnostic.New("AIDD_BASELINE_REPLACED", path, artifact, "replaced baseline section must change and reference baseline evidence", "changed section with design_block_id", entry)
			}
			block, exists := blocks[entry.DesignBlockID]
			if !exists || block.Type != "evidence" || block.Role != "baseline" || block.OwnerID != baselineSource.ID {
				return diagnostic.New("AIDD_BASELINE_EVIDENCE", path+".design_block_id", artifact, "replaced baseline section must reference owned baseline evidence", map[string]string{"type": "evidence", "role": "baseline", "owner_id": baselineSource.ID}, block)
			}
			if _, duplicate := references[entry.DesignBlockID]; duplicate {
				return diagnostic.New("AIDD_COVERAGE_DUPLICATE_REFERENCE", path+".design_block_id", artifact, "coverage evidence block references must be unique", "unique block ID", entry.DesignBlockID)
			}
			references[entry.DesignBlockID] = struct{}{}
		default:
			return diagnostic.New("AIDD_BASELINE_STATUS", path+".status", artifact, "baseline section status is unsupported", []string{"preserved", "replaced"}, entry.Status)
		}
	}
	return nil
}

func validateSourceSections(raw json.RawMessage, allowRequirements bool, artifact string) ([]sourceSection, map[string]sourceBlock, error) {
	var sections []sourceSection
	if err := canonical.Decode(raw, artifact+".validation.sections", &sections); err != nil {
		return nil, nil, err
	}
	if len(sections) == 0 {
		return nil, nil, diagnostic.New("AIDD_SECTIONS_EMPTY", "validation.sections", artifact, "managed artifact sections must be non-empty", "non-empty section inventory", sections)
	}
	sectionIDs := map[string]struct{}{}
	headings := map[string]struct{}{}
	blocks := map[string]sourceBlock{}
	for sectionIndex, section := range sections {
		path := fmt.Sprintf("validation.sections[%d]", sectionIndex)
		if !lowerKebabPattern.MatchString(section.ID) {
			return nil, nil, diagnostic.New("AIDD_SECTION_ID", path+".id", artifact, "section ID must use lowercase ASCII kebab-case", "lowercase-kebab-case", section.ID)
		}
		if _, duplicate := sectionIDs[section.ID]; duplicate {
			return nil, nil, diagnostic.New("AIDD_SECTION_DUPLICATE", path+".id", artifact, "section IDs must be unique", "unique ID", section.ID)
		}
		if strings.TrimSpace(section.Heading) == "" {
			return nil, nil, diagnostic.New("AIDD_SECTION_HEADING", path+".heading", artifact, "section heading must be non-empty", nil, section.Heading)
		}
		if _, duplicate := headings[section.Heading]; duplicate {
			return nil, nil, diagnostic.New("AIDD_SECTION_HEADING_DUPLICATE", path+".heading", artifact, "section headings must be unique", "unique heading", section.Heading)
		}
		if len(section.Blocks) == 0 {
			return nil, nil, diagnostic.New("AIDD_SECTION_BLOCKS", path+".blocks", artifact, "section blocks must be non-empty", "non-empty block inventory", section.Blocks)
		}
		sectionIDs[section.ID] = struct{}{}
		headings[section.Heading] = struct{}{}
		for blockIndex, block := range section.Blocks {
			blockPath := fmt.Sprintf("%s.blocks[%d]", path, blockIndex)
			if !lowerKebabPattern.MatchString(block.ID) {
				return nil, nil, diagnostic.New("AIDD_BLOCK_ID", blockPath+".id", artifact, "block ID must use lowercase ASCII kebab-case", "lowercase-kebab-case", block.ID)
			}
			if _, duplicate := blocks[block.ID]; duplicate {
				return nil, nil, diagnostic.New("AIDD_BLOCK_DUPLICATE", blockPath+".id", artifact, "block IDs must be globally unique", "unique ID", block.ID)
			}
			switch block.Type {
			case "markdown":
				if strings.TrimSpace(block.Markdown) == "" {
					return nil, nil, diagnostic.New("AIDD_MARKDOWN_BLOCK", blockPath+".markdown", artifact, "markdown block must contain text", nil, block.Markdown)
				}
			case "requirements":
				if !allowRequirements {
					return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_BLOCK", blockPath+".type", artifact, "requirements blocks are only valid in Requirements artifacts", "markdown or evidence", block.Type)
				}
			case "evidence":
				if block.Role != "design" && block.Role != "verification" && block.Role != "baseline" {
					return nil, nil, diagnostic.New("AIDD_EVIDENCE_ROLE", blockPath+".role", artifact, "evidence role is unsupported", []string{"design", "verification", "baseline"}, block.Role)
				}
				if strings.TrimSpace(block.OwnerID) == "" || len([]rune(normalizeEvidence(block.Text))) < 8 {
					return nil, nil, diagnostic.New("AIDD_EVIDENCE_CONTENT", blockPath, artifact, "evidence must have an owner and substantive text", "owner_id and at least 8 substantive characters", block)
				}
			default:
				return nil, nil, diagnostic.New("AIDD_BLOCK_TYPE", blockPath+".type", artifact, "block type is unsupported", []string{"markdown", "evidence", "requirements"}, block.Type)
			}
			blocks[block.ID] = block
		}
	}
	return sections, blocks, nil
}

func validateRequirementsSections(raw json.RawMessage, sectionContract *requirementscontract.Resolved, artifact string) ([]sourceSection, map[string]sourceBlock, error) {
	sections, blocks, err := validateSourceSections(raw, true, artifact)
	if err != nil {
		return nil, nil, err
	}
	actualIDs := make([]string, len(sections))
	for index, section := range sections {
		actualIDs[index] = section.ID
		if !sectionContract.MatchHeading(section.ID, section.Heading) {
			return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_HEADING", fmt.Sprintf("validation.sections[%d].heading", index), artifact, "Requirements section heading must exactly map to its canonical section ID", section.ID, section.Heading)
		}
	}
	if !equalStrings(actualIDs, sectionContract.IDs) {
		return nil, nil, diagnostic.New("AIDD_REQUIREMENTS_SECTIONS", "validation.sections", artifact, "Requirements sections must use the canonical inventory and order", sectionContract.IDs, actualIDs)
	}
	return sections, blocks, nil
}

func extractSourceSections(content []byte, kind, artifact string) (json.RawMessage, error) {
	var source struct {
		Kind       string `json:"kind"`
		Validation struct {
			Sections json.RawMessage `json:"sections"`
		} `json:"validation"`
	}
	if err := json.Unmarshal(content, &source); err != nil {
		return nil, diagnostic.New("AIDD_BASELINE_SOURCE", "validation.sections", artifact, "Git HEAD baseline source is invalid", kind, err.Error())
	}
	if source.Kind != kind {
		return nil, diagnostic.New("AIDD_BASELINE_KIND", "kind", artifact, "Git HEAD baseline kind is invalid", kind, source.Kind)
	}
	return source.Validation.Sections, nil
}

func normalizeEvidence(value string) string {
	var result strings.Builder
	for _, character := range strings.ToLower(strings.TrimSpace(value)) {
		if character == ' ' || character == '\n' || character == '\r' || character == '\t' {
			continue
		}
		result.WriteRune(character)
	}
	return result.String()
}

func validateTransition(item transition, issueBody, artifact string) error {
	allowed := map[string]bool{"new": true, "changed": true, "unchanged": true}
	if !allowed[item.Status] {
		return diagnostic.New("AIDD_TRANSITION_STATUS", item.ID, artifact, "transition status is unsupported", []string{"new", "changed", "unchanged"}, item.Status)
	}
	if item.Status == "new" || item.Status == "changed" {
		if item.IssueEvidence == nil || *item.IssueEvidence == "" || !strings.Contains(issueBody, *item.IssueEvidence) {
			return diagnostic.New("AIDD_TRANSITION_EVIDENCE", item.ID, artifact, "new or changed transition requires literal Issue evidence", "Issue substring", item.IssueEvidence)
		}
	} else if item.IssueEvidence != nil {
		return diagnostic.New("AIDD_TRANSITION_EVIDENCE", item.ID, artifact, "unchanged transition must use null Issue evidence", nil, item.IssueEvidence)
	}
	return nil
}

func validateBaseline(ctx context.Context, snapshot *repository.Snapshot, workspace string, baselineRecord baseline, artifact string) error {
	_, err := validateArtifactBaseline(ctx, snapshot, workspace, "requirements.json", baselineRecord, artifact, "AIDD_REQUIREMENTS_BASELINE")
	return err
}

func validateArtifactBaseline(ctx context.Context, snapshot *repository.Snapshot, workspace, filename string, baselineRecord baseline, artifact, code string) ([]byte, error) {
	path, err := repository.WorkspacePath(workspace, filename)
	if err != nil {
		return nil, err
	}
	entry, err := snapshot.Git(ctx, "ls-tree", "--name-only", "-z", "HEAD", "--", path)
	if err != nil {
		return nil, err
	}
	if len(entry) == 0 {
		if baselineRecord.Source != "none" || baselineRecord.BodySHA256 != nil {
			return nil, diagnostic.New(code, "validation.baseline", artifact, "missing Git HEAD baseline must be represented as none", baseline{Source: "none", BodySHA256: nil}, baselineRecord)
		}
		return nil, nil
	}
	output, err := snapshot.Git(ctx, "show", "HEAD:"+path)
	if err != nil {
		return nil, err
	}
	digest := canonical.HashBytes(output)
	if baselineRecord.Source != "git_head" || baselineRecord.BodySHA256 == nil || !sha256Pattern.MatchString(*baselineRecord.BodySHA256) || *baselineRecord.BodySHA256 != digest {
		return nil, diagnostic.New(code, "validation.baseline", artifact, "existing Git HEAD baseline must be hash-fixed", map[string]any{"source": "git_head", "body_sha256": digest}, baselineRecord)
	}
	return output, nil
}

func ruleMatches(rule rules.Rule, selection match) bool {
	var values []string
	switch selection.Field {
	case "paths":
		values = rule.AppliesTo.Paths
	case "domains":
		values = rule.AppliesTo.Domains
	case "activities":
		values = rule.AppliesTo.Activities
	case "topics":
		values = rule.AppliesTo.Topics
	default:
		return false
	}
	for _, value := range values {
		if value == selection.Value {
			return true
		}
	}
	return false
}

func sameStringSet(left, right map[string]struct{}) bool {
	if len(left) != len(right) {
		return false
	}
	for value := range left {
		if _, ok := right[value]; !ok {
			return false
		}
	}
	return true
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func equalJSON(left, right any) bool {
	leftBytes, leftErr := canonical.Marshal(left)
	rightBytes, rightErr := canonical.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftBytes) == string(rightBytes)
}

func SortedTransitions(values []transition) []transition {
	result := append([]transition(nil), values...)
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}

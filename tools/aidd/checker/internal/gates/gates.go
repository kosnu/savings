package gates

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/requirementscontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
	"golang.org/x/text/cases"
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

type taskContext = model.TaskContext
type directRule = model.DirectRule
type match = model.RuleMatch
type dependency = model.RuleDependency
type inputGate = model.RequirementsInputGate
type transition = model.RequirementTransition
type retirement = model.RequirementRetirement
type baseline = model.Baseline
type completenessGate = model.RequirementsCompletenessGate
type sourceSection = model.Section
type sourceBlock = model.Block
type coverageEntry = model.CoverageEntry
type baselineSection = model.BaselineSection

var (
	requirementIDPattern      = regexp.MustCompile(`^(?:FR|NFR|AC)-[1-9][0-9]*$`)
	requirementMentionPattern = regexp.MustCompile(`(?:FR|NFR|AC)-[1-9][0-9]*`)
	sha256Pattern             = regexp.MustCompile(`^[0-9a-f]{64}$`)
	issueIDPattern            = regexp.MustCompile(`^([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]+)#([1-9][0-9]*)$`)
	issueEvidenceFolder       = cases.Fold()
)

var retirementTerms = []string{"対象外", "廃止", "削除", "撤回", "不要"}

var retirementEnglishTermPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\bout of scope\b`),
	regexp.MustCompile(`\bremove\b`),
	regexp.MustCompile(`\bremoved\b`),
	regexp.MustCompile(`\bretire\b`),
	regexp.MustCompile(`\bretired\b`),
	regexp.MustCompile(`\bdrop\b`),
	regexp.MustCompile(`\bdropped\b`),
	regexp.MustCompile(`\bdeprecate\b`),
	regexp.MustCompile(`\bdeprecated\b`),
}

var negatedRetirementPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?:対象外|廃止|削除|撤回|不要)(?:に|と|を)?(?:は)?(?:しない|しません|されない|されません|する必要はない|する必要がない|する必要はありません|の必要はない|することはない|されることはない|ではない|でない|は不要)`),
	regexp.MustCompile(`(?:対象外|廃止|削除|撤回|不要)(?:(?:に|と)?(?:する|される)?こと)?(?:に|と|を|は)?禁止`),
	regexp.MustCompile(`\b(?:do|does|must|should|shall|will|can) not (?:remove|retire|drop|deprecate)\b`),
	regexp.MustCompile(`\bnever (?:remove|retire|drop|deprecate)\b`),
	regexp.MustCompile(`\b(?:don't|doesn't|mustn't|shouldn't|won't|can't) (?:be )?(?:remove|removed|retire|retired|drop|dropped|deprecate|deprecated)\b`),
	regexp.MustCompile(`\bnot (?:be )?(?:removed|retired|dropped|deprecated)\b`),
	regexp.MustCompile(`\bnot (?:be |considered )?out of scope\b`),
	regexp.MustCompile(`\b(?:isn't|aren't) out of scope\b`),
	regexp.MustCompile(`\b(?:removal|retirement|dropping|deprecation) (?:is )?not (?:required|needed)\b`),
}

var genericImplementationTopics = map[string]struct{}{
	"documentation": {},
	"mock":          {},
	"repository":    {},
	"review":        {},
	"test":          {},
	"ui":            {},
	"verification":  {},
	"web":           {},
}

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

type designCoverageGate = model.DesignCoverageGate

func ValidateDesign(ctx context.Context, snapshot *repository.Snapshot, input DesignInput) (*DesignResult, error) {
	if input.Kind != "design" && input.Kind != "design_goal" {
		return nil, diagnostic.New("AIDD_DESIGN_KIND", "kind", "design_gate", "Design gate kind is unsupported", []string{"design", "design_goal"}, input.Kind)
	}
	preparsedRequirements, err := semantic.ParseSource(input.Requirements, "requirements", "requirements")
	if err != nil {
		return nil, err
	}
	if preparsedRequirements.ReadOnlyLegacy || preparsedRequirements.Envelope.Workspace != input.Workspace {
		return nil, diagnostic.New("AIDD_DESIGN_REQUIREMENTS", "requirements", input.Kind, "Design requires current schema v4 canonical Requirements for the same cycle", input.Workspace, preparsedRequirements.Envelope)
	}
	issue := input.Issue
	issue.Title = preparsedRequirements.Requirements.CycleStartIssueTitle
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
	gate := parsed.Design.CoverageGate
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
	input := requirements.Requirements.InputGate
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

func extractRequirementsBaseline(content []byte, sectionContract *requirementscontract.Resolved) (map[string]model.Requirement, map[string]sourceSection, error) {
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
	sections, blocks, err := validateSourceSections(parsed.Design.Sections)
	if err != nil {
		return err
	}
	references := map[string]struct{}{}
	for _, entry := range gate.Coverage {
		references[entry.DesignBlockID] = struct{}{}
		references[entry.VerificationBlockID] = struct{}{}
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
	decodedBaselineSections, err := semantic.DecodeSections(baselineRaw, false, "git_head_design")
	if err != nil {
		return err
	}
	baselineSections, _, err := validateSourceSections(decodedBaselineSections)
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

func validateSourceSections(sections []sourceSection) ([]sourceSection, map[string]sourceBlock, error) {
	blocks := map[string]sourceBlock{}
	for _, section := range sections {
		for _, block := range section.Blocks {
			blocks[block.ID] = block
		}
	}
	return sections, blocks, nil
}

func validateRequirementsSections(sections []sourceSection, sectionContract *requirementscontract.Resolved, artifact string) ([]sourceSection, map[string]sourceBlock, error) {
	sections, blocks, err := validateSourceSections(sections)
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
	var source model.Source
	if err := canonical.Decode(content, artifact, &source); err != nil {
		return nil, err
	}
	if source.Kind != kind {
		return nil, diagnostic.New("AIDD_BASELINE_KIND", "kind", artifact, "Git HEAD baseline kind is invalid", kind, source.Kind)
	}
	var validation struct {
		Sections json.RawMessage `json:"sections"`
	}
	if err := json.Unmarshal(source.Validation, &validation); err != nil {
		return nil, diagnostic.New("AIDD_BASELINE_SOURCE", "validation.sections", artifact, "Git HEAD baseline source is invalid", kind, err.Error())
	}
	return validation.Sections, nil
}

func normalizeIssueEvidence(value string) string {
	fields := strings.FieldsFunc(value, unicode.IsSpace)
	return issueEvidenceFolder.String(strings.Join(fields, " "))
}

func validateOwnedTransitions(items []transition, issueBody string, ownerContents map[string]string, artifact, ownerKind string) error {
	evidenceOwners := map[string]string{}
	codeOwner := "AIDD_" + strings.ToUpper(ownerKind) + "_EVIDENCE_OWNER"
	codeDuplicate := "AIDD_" + strings.ToUpper(ownerKind) + "_EVIDENCE_DUPLICATE"
	codeAmbiguous := "AIDD_" + strings.ToUpper(ownerKind) + "_EVIDENCE_AMBIGUOUS"
	for _, item := range items {
		if err := validateTransition(item, issueBody, artifact); err != nil {
			return err
		}
		if item.IssueEvidence == nil {
			continue
		}
		normalizedEvidence := normalizeIssueEvidence(*item.IssueEvidence)
		if previous, duplicate := evidenceOwners[normalizedEvidence]; duplicate {
			return diagnostic.New(codeDuplicate, item.ID, artifact, ownerKind+" transition evidence must be unique per owner", previous, item.ID)
		}
		evidenceOwners[normalizedEvidence] = item.ID
		ownerContent, exists := ownerContents[item.ID]
		if !exists || !strings.Contains(normalizeIssueEvidence(ownerContent), normalizedEvidence) {
			return diagnostic.New(codeOwner, item.ID, artifact, ownerKind+" transition evidence must occur in its owned content", ownerContent, *item.IssueEvidence)
		}
		for otherID, otherContent := range ownerContents {
			if otherID != item.ID && strings.Contains(normalizeIssueEvidence(otherContent), normalizedEvidence) {
				return diagnostic.New(codeAmbiguous, item.ID, artifact, ownerKind+" transition evidence must not map to another owner", item.ID, otherID)
			}
		}
	}
	return nil
}

func validateRetirementEvidence(item retirement, issueBody, path, artifact string) error {
	normalizedEvidence := normalizeIssueEvidence(item.IssueEvidence)
	if normalizedEvidence == "" || !strings.Contains(normalizeIssueEvidence(issueBody), normalizedEvidence) {
		return diagnostic.New("AIDD_RETIRED_EVIDENCE", path+".issue_evidence", artifact, "retirement evidence must be a literal substring of the Issue body", "Issue substring", item.IssueEvidence)
	}
	mentionedIDs := map[string]struct{}{}
	for _, mention := range requirementMentionPattern.FindAllString(item.IssueEvidence, -1) {
		mentionedIDs[mention] = struct{}{}
	}
	if _, mentioned := mentionedIDs[item.ID]; !mentioned {
		return diagnostic.New("AIDD_RETIRED_EVIDENCE_ID", path+".issue_evidence", artifact, "retirement evidence must name its Requirement ID", item.ID, item.IssueEvidence)
	}
	if len(mentionedIDs) != 1 {
		return diagnostic.New("AIDD_RETIRED_EVIDENCE_AMBIGUOUS", path+".issue_evidence", artifact, "retirement evidence must name only its retired Requirement ID", item.ID, rules.Sorted(mentionedIDs))
	}
	explicit := false
	for _, term := range retirementTerms {
		if strings.Contains(normalizedEvidence, term) {
			explicit = true
			break
		}
	}
	if !explicit {
		for _, pattern := range retirementEnglishTermPatterns {
			if pattern.MatchString(normalizedEvidence) {
				explicit = true
				break
			}
		}
	}
	if !explicit {
		return diagnostic.New("AIDD_RETIRED_EVIDENCE_INTENT", path+".issue_evidence", artifact, "retirement evidence must explicitly state retirement", "affirmative retirement term", item.IssueEvidence)
	}
	for _, pattern := range negatedRetirementPatterns {
		if pattern.MatchString(normalizedEvidence) {
			return diagnostic.New("AIDD_RETIRED_EVIDENCE_NEGATED", path+".issue_evidence", artifact, "retirement evidence must not negate retirement", "affirmative retirement", item.IssueEvidence)
		}
	}
	return nil
}

func requirementsSectionContents(sections []sourceSection, requirements []model.Requirement) map[string]string {
	contents := make(map[string]string, len(sections))
	for _, section := range sections {
		parts := []string{}
		for _, block := range section.Blocks {
			switch block.Type {
			case "markdown":
				parts = append(parts, block.Markdown)
			case "evidence":
				parts = append(parts, block.Text)
			case "requirements":
				for _, requirement := range requirements {
					if requirement.SectionID == section.ID {
						parts = append(parts, requirement.Text)
					}
				}
			}
		}
		contents[section.ID] = strings.Join(parts, "\n")
	}
	return contents
}

type sectionRequirementHashEntry struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type requirementsSectionHashValue struct {
	Heading      string                        `json:"heading"`
	Blocks       []sourceBlock                 `json:"blocks"`
	Requirements []sectionRequirementHashEntry `json:"requirements"`
}

func requirementsSectionHash(section sourceSection, requirements map[string]model.Requirement) (string, error) {
	ids := make([]string, 0, len(requirements))
	for id, requirement := range requirements {
		if requirement.SectionID == section.ID {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return requirementSortKey(ids[i]) < requirementSortKey(ids[j]) })
	entries := make([]sectionRequirementHashEntry, len(ids))
	for index, id := range ids {
		entries[index] = sectionRequirementHashEntry{ID: id, Text: requirements[id].Text}
	}
	return canonical.Hash(requirementsSectionHashValue{Heading: section.Heading, Blocks: section.Blocks, Requirements: entries})
}

func validateIssueSnapshot(issue IssueSnapshot, artifact string) error {
	match := issueIDPattern.FindStringSubmatch(issue.ID)
	if match == nil {
		return diagnostic.New("AIDD_ISSUE_ID", "validation.input_gate.task_context.issue", artifact, "Issue identity must use owner/repo#number", "owner/repo#number", issue.ID)
	}
	expectedURL := "https://github.com/" + match[1] + "/" + match[2] + "/issues/" + match[3]
	if issue.URL != expectedURL {
		return diagnostic.New("AIDD_ISSUE_URL", "validation.input_gate.task_context.url", artifact, "Issue URL must match the Issue identity", expectedURL, issue.URL)
	}
	if !strings.HasSuffix(issue.UpdatedAt, "Z") {
		return diagnostic.New("AIDD_ISSUE_UPDATED_AT", "validation.input_gate.task_context.updated_at", artifact, "Issue updatedAt must be an RFC 3339 UTC timestamp", "RFC 3339 ending in Z", issue.UpdatedAt)
	}
	if _, err := time.Parse(time.RFC3339Nano, issue.UpdatedAt); err != nil {
		return diagnostic.New("AIDD_ISSUE_UPDATED_AT", "validation.input_gate.task_context.updated_at", artifact, "Issue updatedAt must be an RFC 3339 UTC timestamp", "RFC 3339 ending in Z", issue.UpdatedAt)
	}
	if strings.TrimSpace(issue.Title) == "" {
		return diagnostic.New("AIDD_ISSUE_TITLE", "validation.cycle_start_issue_title", artifact, "cycle-start Issue title must be non-empty", "non-empty exact title", issue.Title)
	}
	if !utf8.Valid(issue.Body) {
		return diagnostic.New("AIDD_ISSUE_BODY_UTF8", "validation.input_gate.task_context.body_sha256", artifact, "Issue body must be valid UTF-8", "valid UTF-8", nil)
	}
	return nil
}

func validateExplicitSurface(rule rules.Rule, selection directRule, normalizedEvidence, path, artifact string) error {
	implementationRule := false
	for _, pattern := range rule.AppliesTo.Paths {
		if strings.HasPrefix(pattern, "apps/") {
			implementationRule = true
			break
		}
	}
	if !implementationRule || strings.HasPrefix(rule.ID, "domain.") {
		return nil
	}
	normalizedSurface := normalizeIssueEvidence(selection.ExplicitSurface)
	if normalizedSurface == "" {
		return diagnostic.New("AIDD_RULE_EXPLICIT_SURFACE", path+".explicit_surface", artifact, "non-domain implementation rule requires a distinctive explicit_surface", "declared distinctive topic", selection.ExplicitSurface)
	}
	distinctive := false
	for _, topic := range rule.AppliesTo.Topics {
		normalizedTopic := normalizeIssueEvidence(topic)
		if _, generic := genericImplementationTopics[normalizedTopic]; generic {
			continue
		}
		if normalizedSurface == normalizedTopic {
			distinctive = true
			break
		}
	}
	if !distinctive {
		return diagnostic.New("AIDD_RULE_EXPLICIT_SURFACE", path+".explicit_surface", artifact, "explicit_surface must equal a distinctive declared topic", rule.AppliesTo.Topics, selection.ExplicitSurface)
	}
	if !strings.Contains(normalizedEvidence, normalizedSurface) {
		return diagnostic.New("AIDD_RULE_EXPLICIT_SURFACE_EVIDENCE", path+".explicit_surface", artifact, "explicit_surface must be present in Issue evidence", selection.ExplicitSurface, selection.IssueEvidence)
	}
	return nil
}

func validateTransition(item transition, issueBody, artifact string) error {
	allowed := map[string]bool{"new": true, "changed": true, "unchanged": true}
	if !allowed[item.Status] {
		return diagnostic.New("AIDD_TRANSITION_STATUS", item.ID, artifact, "transition status is unsupported", []string{"new", "changed", "unchanged"}, item.Status)
	}
	if item.Status == "new" || item.Status == "changed" {
		if item.IssueEvidence == nil || normalizeIssueEvidence(*item.IssueEvidence) == "" || !strings.Contains(normalizeIssueEvidence(issueBody), normalizeIssueEvidence(*item.IssueEvidence)) {
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
	output, exists, err := snapshot.ReadHeadBlob(ctx, path)
	if err != nil {
		return nil, err
	}
	if !exists {
		if baselineRecord.Source != "none" || baselineRecord.BodySHA256 != nil {
			return nil, diagnostic.New(code, "validation.baseline", artifact, "missing Git HEAD baseline must be represented as none", baseline{Source: "none", BodySHA256: nil}, baselineRecord)
		}
		return nil, nil
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

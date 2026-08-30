package gates

import (
	"context"
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

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
	if err := snapshot.AssertGitHeadUnchanged(ctx); err != nil {
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
	automaticDirect := map[string]struct{}{}
	input := requirements.Requirements.InputGate
	for _, direct := range input.DirectRules {
		automaticDirect[direct.ID] = struct{}{}
	}
	for _, dependency := range input.DependsOn {
		automaticDirect[dependency.ID] = struct{}{}
	}
	for _, surfaceID := range declaredSurfaces {
		for _, surface := range loadedRules.Map.ReviewRouting.Surfaces {
			if surface.ID == surfaceID {
				for _, ruleID := range surface.RequiredRules {
					automaticDirect[ruleID] = struct{}{}
				}
			}
		}
	}
	selectedDirect, err := validateAdditionalRules(design.Design.RuleCoverage.AdditionalRules, automaticDirect, loadedRules, design.Envelope.Kind)
	if err != nil {
		return err
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
	if err := validateSelectedRuleOwnership(&design.Design.TargetState, selectedClosure, loadedRules, design.Envelope.Kind); err != nil {
		return err
	}
	return nil
}

func validateSelectedRuleOwnership(target *model.TargetState, selected map[string]struct{}, loadedRules *rules.Loaded, artifact string) error {
	for _, ruleID := range loadedRules.Order {
		if _, exists := selected[ruleID]; !exists {
			continue
		}
		rule := loadedRules.ByID[ruleID]
		for _, scope := range target.OwnershipScopes {
			insideScope := rule.File == scope.Path
			if scope.Kind == "tree" {
				insideScope = insideScope || strings.HasPrefix(rule.File, scope.Path+"/")
			}
			if insideScope {
				return diagnostic.New(
					"AIDD_SELECTED_RULE_OWNERSHIP",
					rule.File,
					artifact,
					"selected rule documents are read-only Design inputs and cannot be Build ownership targets",
					"selected rule path outside ownership scopes",
					map[string]any{"rule_id": ruleID, "scope": scope},
				)
			}
		}
	}
	return nil
}

func validateAdditionalRules(additional []model.AdditionalRule, automaticDirect map[string]struct{}, loadedRules *rules.Loaded, artifact string) (map[string]struct{}, error) {
	automaticClosure, err := rules.ExpandClosure(loadedRules, automaticDirect)
	if err != nil {
		return nil, err
	}
	additionalSet := make(map[string]struct{}, len(additional))
	additionalIDs := make([]string, len(additional))
	for index, entry := range additional {
		path := fmt.Sprintf("validation.rule_coverage.additional_rules[%d].id", index)
		if _, exists := loadedRules.ByID[entry.ID]; !exists {
			return nil, diagnostic.New("AIDD_ADDITIONAL_RULE_UNKNOWN", path, artifact, "additional rule must exist in the canonical rule map", loadedRules.Order, entry.ID)
		}
		if _, automatic := automaticClosure[entry.ID]; automatic {
			return nil, diagnostic.New("AIDD_ADDITIONAL_RULE_AUTOMATIC", path, artifact, "additional rule must not repeat a rule selected automatically by Requirements or implementation surfaces", rules.Sorted(automaticClosure), entry.ID)
		}
		additionalSet[entry.ID] = struct{}{}
		additionalIDs[index] = entry.ID
	}
	expectedOrder := make([]string, 0, len(additionalSet))
	for _, ruleID := range loadedRules.Order {
		if _, exists := additionalSet[ruleID]; exists {
			expectedOrder = append(expectedOrder, ruleID)
		}
	}
	if !equalStrings(additionalIDs, expectedOrder) {
		return nil, diagnostic.New("AIDD_ADDITIONAL_RULE_ORDER", "validation.rule_coverage.additional_rules", artifact, "additional rules must use canonical rule-map order", expectedOrder, additionalIDs)
	}
	selected := make(map[string]struct{}, len(automaticDirect)+len(additionalSet))
	for ruleID := range automaticDirect {
		selected[ruleID] = struct{}{}
	}
	for ruleID := range additionalSet {
		selected[ruleID] = struct{}{}
	}
	return selected, nil
}

func validateDesignCoverage(ctx context.Context, snapshot *repository.Snapshot, parsed *semantic.ParsedSource, gate model.DesignCoverageGate, workspace, artifact string) error {
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
			return diagnostic.New("AIDD_BASELINE_SECTIONS", "validation.coverage_gate.baseline_sections", artifact, "baseline_sections must be empty when Git HEAD has no Design baseline", []model.BaselineSection{}, gate.BaselineSections)
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
	currentByID := make(map[string]model.Section, len(sections))
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

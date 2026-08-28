package semantic

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

type designValidationWire struct {
	Mode         string          `json:"mode"`
	Sections     json.RawMessage `json:"sections"`
	TargetState  json.RawMessage `json:"target_state"`
	RuleCoverage json.RawMessage `json:"rule_coverage"`
	CoverageGate json.RawMessage `json:"coverage_gate"`
}

type requirementsValidationWire struct {
	Mode                 string            `json:"mode"`
	CycleStartIssueTitle string            `json:"cycle_start_issue_title"`
	InputGate            json.RawMessage   `json:"input_gate"`
	CompletenessGate     json.RawMessage   `json:"completeness_gate"`
	Requirements         []json.RawMessage `json:"requirements"`
	Sections             json.RawMessage   `json:"sections"`
}

type requirementsInputGateWire struct {
	TaskContext model.TaskContext      `json:"task_context"`
	DirectRules []json.RawMessage      `json:"direct_rules"`
	DependsOn   []model.RuleDependency `json:"depends_on"`
}

type directRuleWire struct {
	ID            string          `json:"id"`
	IssueEvidence string          `json:"issue_evidence"`
	Match         model.RuleMatch `json:"match"`
	Reason        string          `json:"reason"`
}

type directRuleWithSurfaceWire struct {
	ID              string          `json:"id"`
	IssueEvidence   string          `json:"issue_evidence"`
	Match           model.RuleMatch `json:"match"`
	Reason          string          `json:"reason"`
	ExplicitSurface string          `json:"explicit_surface"`
}

type artifactRequirementWire struct {
	ID        string `json:"id"`
	SectionID string `json:"section_id"`
	Text      string `json:"text"`
}

type goalRequirementWire struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type designCoverageGateWire struct {
	RequirementsSHA256 string                `json:"requirements_sha256"`
	Workspace          string                `json:"workspace"`
	RequirementIDs     []string              `json:"requirement_ids"`
	Baseline           model.Baseline        `json:"baseline"`
	Coverage           []model.CoverageEntry `json:"coverage"`
	BaselineSections   []json.RawMessage     `json:"baseline_sections"`
}

type preservedBaselineSectionWire struct {
	SectionID     *string `json:"section_id"`
	Heading       string  `json:"heading"`
	ContentSHA256 string  `json:"content_sha256"`
	Status        string  `json:"status"`
}

type replacedBaselineSectionWire struct {
	SectionID     *string `json:"section_id"`
	Heading       string  `json:"heading"`
	ContentSHA256 string  `json:"content_sha256"`
	Status        string  `json:"status"`
	DesignBlockID string  `json:"design_block_id"`
}

type targetStateWire struct {
	ProductBehaviors  []model.ProductBehavior `json:"product_behaviors"`
	VerificationCases []json.RawMessage       `json:"verification_cases"`
	OwnershipScopes   []model.OwnershipScope  `json:"ownership_scopes"`
	Representations   []json.RawMessage       `json:"representations"`
}

type automatedCaseWire struct {
	ID                    string          `json:"id"`
	Type                  string          `json:"type"`
	RequirementID         string          `json:"requirement_id"`
	ProductBehaviorIDs    []string        `json:"product_behavior_ids"`
	VerificationProfileID string          `json:"verification_profile_id"`
	Selector              json.RawMessage `json:"selector"`
}

type manualCaseWire struct {
	ID                 string   `json:"id"`
	Type               string   `json:"type"`
	RequirementID      string   `json:"requirement_id"`
	ProductBehaviorIDs []string `json:"product_behavior_ids"`
	Procedure          string   `json:"procedure"`
}

type suiteSelectorWire struct {
	Kind string `json:"kind"`
}

type testCaseSelectorWire struct {
	Kind string `json:"kind"`
	Path string `json:"path"`
	Name string `json:"name"`
}

type representationWire struct {
	ID                  string          `json:"id"`
	Kind                string          `json:"kind"`
	Path                string          `json:"path"`
	Locator             json.RawMessage `json:"locator"`
	RequirementID       string          `json:"requirement_id"`
	ProductBehaviorIDs  []string        `json:"product_behavior_ids"`
	VerificationCaseIDs []string        `json:"verification_case_ids"`
}

type fileLocatorWire struct {
	Kind string `json:"kind"`
}

type namedLocatorWire struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

func decodeRequirementsValidation(raw json.RawMessage, kind, artifact string) (*model.RequirementsValidation, error) {
	if err := requireJSONFields(raw, "validation", artifact, "mode", "cycle_start_issue_title", "input_gate", "completeness_gate", "requirements", "sections"); err != nil {
		return nil, err
	}
	var wire requirementsValidationWire
	if err := canonical.Decode(raw, artifact+".validation", &wire); err != nil {
		return nil, err
	}
	inputGate, err := decodeRequirementsInputGate(wire.InputGate, artifact)
	if err != nil {
		return nil, err
	}
	var completeness model.RequirementsCompletenessGate
	if err := canonical.Decode(wire.CompletenessGate, artifact+".validation.completeness_gate", &completeness); err != nil {
		return nil, err
	}
	requirements := make([]model.Requirement, 0, len(wire.Requirements))
	for index, rawRequirement := range wire.Requirements {
		path := fmt.Sprintf("validation.requirements[%d]", index)
		switch kind {
		case "requirements":
			if err := requireJSONFields(rawRequirement, path, artifact, "id", "section_id", "text"); err != nil {
				return nil, err
			}
			var item artifactRequirementWire
			if err := canonical.Decode(rawRequirement, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			requirements = append(requirements, model.Requirement{ID: item.ID, SectionID: item.SectionID, Text: item.Text})
		case "requirements_goal":
			if err := requireJSONFields(rawRequirement, path, artifact, "id", "text"); err != nil {
				return nil, err
			}
			var item goalRequirementWire
			if err := canonical.Decode(rawRequirement, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			requirements = append(requirements, model.Requirement{ID: item.ID, Text: item.Text})
		default:
			return nil, diagnostic.New("AIDD_REQUIREMENTS_KIND", "kind", artifact, "Requirements source kind is unsupported", []string{"requirements", "requirements_goal"}, kind)
		}
	}
	sections, err := DecodeSections(wire.Sections, true, artifact)
	if err != nil {
		return nil, err
	}
	return &model.RequirementsValidation{
		Mode: wire.Mode, CycleStartIssueTitle: wire.CycleStartIssueTitle,
		InputGate: *inputGate, CompletenessGate: completeness,
		Requirements: requirements, Sections: sections,
	}, nil
}

func decodeRequirementsInputGate(raw json.RawMessage, artifact string) (*model.RequirementsInputGate, error) {
	if err := requireJSONFields(raw, "validation.input_gate", artifact, "task_context", "direct_rules", "depends_on"); err != nil {
		return nil, err
	}
	var wire requirementsInputGateWire
	if err := canonical.Decode(raw, artifact+".validation.input_gate", &wire); err != nil {
		return nil, err
	}
	result := &model.RequirementsInputGate{
		TaskContext: wire.TaskContext,
		DirectRules: make([]model.DirectRule, 0, len(wire.DirectRules)),
		DependsOn:   wire.DependsOn,
	}
	for index, rawRule := range wire.DirectRules {
		path := fmt.Sprintf("validation.input_gate.direct_rules[%d]", index)
		if err := requireJSONFields(rawRule, path, artifact, "id", "issue_evidence", "match", "reason"); err != nil {
			return nil, err
		}
		var keys map[string]json.RawMessage
		if err := json.Unmarshal(rawRule, &keys); err != nil {
			return nil, diagnostic.New("AIDD_DIRECT_RULE_SHAPE", path, artifact, "direct rule shape is invalid", "direct rule object", err.Error())
		}
		var rule model.DirectRule
		if _, hasSurface := keys["explicit_surface"]; hasSurface {
			var item directRuleWithSurfaceWire
			if err := canonical.Decode(rawRule, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			rule = model.DirectRule{ID: item.ID, IssueEvidence: item.IssueEvidence, Match: item.Match, Reason: item.Reason, ExplicitSurface: item.ExplicitSurface}
		} else {
			var item directRuleWire
			if err := canonical.Decode(rawRule, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			rule = model.DirectRule{ID: item.ID, IssueEvidence: item.IssueEvidence, Match: item.Match, Reason: item.Reason}
		}
		if strings.TrimSpace(rule.ID) == "" || strings.ContainsAny(rule.ID, "\r\n") || strings.TrimSpace(rule.Reason) == "" || strings.ContainsAny(rule.Reason, "\r\n") {
			return nil, diagnostic.New("AIDD_DIRECT_RULE_TEXT", path, artifact, "direct rule ID and reason must be non-empty single lines", "non-empty single-line strings", rule)
		}
		if _, hasSurface := keys["explicit_surface"]; hasSurface && strings.TrimSpace(rule.ExplicitSurface) == "" {
			return nil, diagnostic.New("AIDD_DIRECT_RULE_SURFACE", path+".explicit_surface", artifact, "present explicit_surface must be non-empty", "non-empty string or absent", rule.ExplicitSurface)
		}
		result.DirectRules = append(result.DirectRules, rule)
	}
	for index, dependency := range result.DependsOn {
		if strings.TrimSpace(dependency.ID) == "" || strings.ContainsAny(dependency.ID, "\r\n") || strings.TrimSpace(dependency.Via) == "" || strings.ContainsAny(dependency.Via, "\r\n") {
			return nil, diagnostic.New("AIDD_DEPENDENCY_TEXT", fmt.Sprintf("validation.input_gate.depends_on[%d]", index), artifact, "dependency ID and via must be non-empty single lines", "non-empty single-line strings", dependency)
		}
	}
	return result, nil
}

func decodeDesignValidation(raw json.RawMessage, artifact string) (*model.DesignValidation, error) {
	if err := requireJSONFields(raw, "validation", artifact, "mode", "sections", "target_state", "rule_coverage", "coverage_gate"); err != nil {
		return nil, err
	}
	var wire designValidationWire
	if err := canonical.Decode(raw, artifact+".validation", &wire); err != nil {
		return nil, err
	}
	sections, err := DecodeSections(wire.Sections, false, artifact)
	if err != nil {
		return nil, err
	}
	target, err := decodeTargetState(wire.TargetState, artifact)
	if err != nil {
		return nil, err
	}
	coverageGate, err := decodeDesignCoverageGate(wire.CoverageGate, artifact)
	if err != nil {
		return nil, err
	}
	if err := requireJSONFields(wire.RuleCoverage, "validation.rule_coverage", artifact, "implementation_surfaces", "additional_rules"); err != nil {
		return nil, err
	}
	var ruleCoverage model.RuleCoverage
	if err := canonical.Decode(wire.RuleCoverage, artifact+".validation.rule_coverage", &ruleCoverage); err != nil {
		return nil, err
	}
	return &model.DesignValidation{
		Mode: wire.Mode, Sections: sections, TargetState: *target,
		RuleCoverage: ruleCoverage, CoverageGate: *coverageGate,
	}, nil
}

func decodeDesignCoverageGate(raw json.RawMessage, artifact string) (*model.DesignCoverageGate, error) {
	if err := requireJSONFields(raw, "validation.coverage_gate", artifact, "requirements_sha256", "workspace", "requirement_ids", "baseline", "coverage", "baseline_sections"); err != nil {
		return nil, err
	}
	var wire designCoverageGateWire
	if err := canonical.Decode(raw, artifact+".validation.coverage_gate", &wire); err != nil {
		return nil, err
	}
	gate := &model.DesignCoverageGate{
		RequirementsSHA256: wire.RequirementsSHA256, Workspace: wire.Workspace,
		RequirementIDs: wire.RequirementIDs, Baseline: wire.Baseline, Coverage: wire.Coverage,
		BaselineSections: make([]model.BaselineSection, 0, len(wire.BaselineSections)),
	}
	for index, rawSection := range wire.BaselineSections {
		path := fmt.Sprintf("validation.coverage_gate.baseline_sections[%d]", index)
		var discriminator struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(rawSection, &discriminator); err != nil {
			return nil, diagnostic.New("AIDD_BASELINE_SECTION_SHAPE", path, artifact, "baseline section status discriminator is invalid", []string{"preserved", "replaced"}, err.Error())
		}
		switch discriminator.Status {
		case "preserved":
			if err := requireJSONFieldPresence(rawSection, path, artifact, "section_id"); err != nil {
				return nil, err
			}
			if err := requireJSONFields(rawSection, path, artifact, "heading", "content_sha256", "status"); err != nil {
				return nil, err
			}
			var item preservedBaselineSectionWire
			if err := canonical.Decode(rawSection, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			gate.BaselineSections = append(gate.BaselineSections, model.BaselineSection{SectionID: item.SectionID, Heading: item.Heading, ContentSHA256: item.ContentSHA256, Status: item.Status})
		case "replaced":
			if err := requireJSONFieldPresence(rawSection, path, artifact, "section_id"); err != nil {
				return nil, err
			}
			if err := requireJSONFields(rawSection, path, artifact, "heading", "content_sha256", "status", "design_block_id"); err != nil {
				return nil, err
			}
			var item replacedBaselineSectionWire
			if err := canonical.Decode(rawSection, artifact+"."+path, &item); err != nil {
				return nil, err
			}
			gate.BaselineSections = append(gate.BaselineSections, model.BaselineSection{SectionID: item.SectionID, Heading: item.Heading, ContentSHA256: item.ContentSHA256, Status: item.Status, DesignBlockID: item.DesignBlockID})
		default:
			return nil, diagnostic.New("AIDD_BASELINE_STATUS", path+".status", artifact, "baseline section status is unsupported", []string{"preserved", "replaced"}, discriminator.Status)
		}
	}
	return gate, nil
}

func decodeTargetState(raw json.RawMessage, artifact string) (*model.TargetState, error) {
	if err := requireJSONFields(raw, "validation.target_state", artifact, "product_behaviors", "verification_cases", "ownership_scopes", "representations"); err != nil {
		return nil, err
	}
	var wire targetStateWire
	if err := canonical.Decode(raw, artifact+".validation.target_state", &wire); err != nil {
		return nil, err
	}
	target := &model.TargetState{
		ProductBehaviors:  wire.ProductBehaviors,
		OwnershipScopes:   wire.OwnershipScopes,
		VerificationCases: make([]model.VerificationCase, 0, len(wire.VerificationCases)),
		Representations:   make([]model.Representation, 0, len(wire.Representations)),
	}
	for index, rawCase := range wire.VerificationCases {
		verificationCase, err := decodeVerificationCase(rawCase, index, artifact)
		if err != nil {
			return nil, err
		}
		target.VerificationCases = append(target.VerificationCases, verificationCase)
	}
	for index, rawRepresentation := range wire.Representations {
		representation, err := decodeRepresentation(rawRepresentation, index, artifact)
		if err != nil {
			return nil, err
		}
		target.Representations = append(target.Representations, representation)
	}
	return target, nil
}

func decodeVerificationCase(raw json.RawMessage, index int, artifact string) (model.VerificationCase, error) {
	var discriminator struct {
		Type string `json:"type"`
	}
	path := fmt.Sprintf("validation.target_state.verification_cases[%d]", index)
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return model.VerificationCase{}, diagnostic.New("AIDD_CASE_SHAPE", path, artifact, "verification case type discriminator is invalid", []string{"automated", "manual"}, err.Error())
	}
	switch discriminator.Type {
	case "automated":
		if err := requireJSONFields(raw, path, artifact, "id", "type", "requirement_id", "product_behavior_ids", "verification_profile_id", "selector"); err != nil {
			return model.VerificationCase{}, err
		}
		var wire automatedCaseWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.VerificationCase{}, err
		}
		selector, err := decodeSelector(wire.Selector, path+".selector", artifact)
		if err != nil {
			return model.VerificationCase{}, err
		}
		return model.VerificationCase{
			ID: wire.ID, Type: wire.Type, RequirementID: wire.RequirementID,
			ProductBehaviorIDs: wire.ProductBehaviorIDs, VerificationProfileID: wire.VerificationProfileID,
			Selector: selector,
		}, nil
	case "manual":
		if err := requireJSONFields(raw, path, artifact, "id", "type", "requirement_id", "product_behavior_ids", "procedure"); err != nil {
			return model.VerificationCase{}, err
		}
		var wire manualCaseWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.VerificationCase{}, err
		}
		return model.VerificationCase{
			ID: wire.ID, Type: wire.Type, RequirementID: wire.RequirementID,
			ProductBehaviorIDs: wire.ProductBehaviorIDs, Procedure: wire.Procedure,
		}, nil
	default:
		return model.VerificationCase{}, diagnostic.New("AIDD_CASE_TYPE", path+".type", artifact, "verification case type is unsupported", []string{"automated", "manual"}, discriminator.Type)
	}
}

func decodeSelector(raw json.RawMessage, path, artifact string) (*model.Selector, error) {
	var discriminator struct {
		Kind string `json:"kind"`
	}
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return nil, diagnostic.New("AIDD_SELECTOR_SHAPE", path, artifact, "selector kind discriminator is invalid", []string{"suite", "test_case"}, err.Error())
	}
	switch discriminator.Kind {
	case "suite":
		if err := requireJSONFields(raw, path, artifact, "kind"); err != nil {
			return nil, err
		}
		var wire suiteSelectorWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return nil, err
		}
		return &model.Selector{Kind: wire.Kind}, nil
	case "test_case":
		if err := requireJSONFields(raw, path, artifact, "kind", "path", "name"); err != nil {
			return nil, err
		}
		var wire testCaseSelectorWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return nil, err
		}
		return &model.Selector{Kind: wire.Kind, Path: wire.Path, Name: wire.Name}, nil
	default:
		return nil, diagnostic.New("AIDD_SELECTOR_KIND", path+".kind", artifact, "selector kind is unsupported", []string{"suite", "test_case"}, discriminator.Kind)
	}
}

func decodeRepresentation(raw json.RawMessage, index int, artifact string) (model.Representation, error) {
	path := fmt.Sprintf("validation.target_state.representations[%d]", index)
	if err := requireJSONFields(raw, path, artifact, "id", "kind", "path", "locator", "requirement_id", "product_behavior_ids", "verification_case_ids"); err != nil {
		return model.Representation{}, err
	}
	var wire representationWire
	if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
		return model.Representation{}, err
	}
	locator, err := decodeLocator(wire.Locator, path+".locator", artifact)
	if err != nil {
		return model.Representation{}, err
	}
	return model.Representation{
		ID: wire.ID, Kind: wire.Kind, Path: wire.Path, Locator: locator,
		RequirementID: wire.RequirementID, ProductBehaviorIDs: wire.ProductBehaviorIDs,
		VerificationCaseIDs: wire.VerificationCaseIDs,
	}, nil
}

func decodeLocator(raw json.RawMessage, path, artifact string) (model.Locator, error) {
	var discriminator struct {
		Kind string `json:"kind"`
	}
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return model.Locator{}, diagnostic.New("AIDD_LOCATOR_SHAPE", path, artifact, "locator kind discriminator is invalid", []string{"file", "export", "test_case"}, err.Error())
	}
	switch discriminator.Kind {
	case "file":
		if err := requireJSONFields(raw, path, artifact, "kind"); err != nil {
			return model.Locator{}, err
		}
		var wire fileLocatorWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.Locator{}, err
		}
		return model.Locator{Kind: wire.Kind}, nil
	case "export", "test_case":
		if err := requireJSONFields(raw, path, artifact, "kind", "name"); err != nil {
			return model.Locator{}, err
		}
		var wire namedLocatorWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.Locator{}, err
		}
		return model.Locator{Kind: wire.Kind, Name: wire.Name}, nil
	default:
		return model.Locator{}, diagnostic.New("AIDD_LOCATOR_KIND", path+".kind", artifact, "representation locator kind is unsupported", []string{"file", "export", "test_case"}, discriminator.Kind)
	}
}

func requireJSONFields(raw json.RawMessage, path, artifact string, fields ...string) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || object == nil {
		actual := any("not an object")
		if err != nil {
			actual = err.Error()
		}
		return diagnostic.New("AIDD_JSON_SHAPE", path, artifact, "JSON object has an invalid shape", fields, actual)
	}
	for _, field := range fields {
		value, exists := object[field]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return diagnostic.New("AIDD_JSON_SHAPE", path+"."+field, artifact, "required JSON field must be present and non-null", "present non-null field", field)
		}
	}
	return nil
}

func requireJSONFieldPresence(raw json.RawMessage, path, artifact string, fields ...string) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || object == nil {
		actual := any("not an object")
		if err != nil {
			actual = err.Error()
		}
		return diagnostic.New("AIDD_JSON_SHAPE", path, artifact, "JSON object has an invalid shape", fields, actual)
	}
	for _, field := range fields {
		if _, exists := object[field]; !exists {
			return diagnostic.New("AIDD_JSON_SHAPE", path+"."+field, artifact, "required JSON field must be present", "present field", field)
		}
	}
	return nil
}

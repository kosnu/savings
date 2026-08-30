package semantic

import (
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

func validateDesignStructure(validation *model.DesignValidation, artifact string) error {
	blocks := make(map[string]model.Block)
	for _, section := range validation.Sections {
		for _, block := range section.Blocks {
			blocks[block.ID] = block
		}
	}
	if err := validateBehaviorEvidenceOwnership(validation.TargetState.ProductBehaviors, validation.Sections, artifact); err != nil {
		return err
	}
	coverageIDs := make([]string, len(validation.CoverageGate.Coverage))
	references := map[string]struct{}{}
	for index, entry := range validation.CoverageGate.Coverage {
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
	if !equalStrings(coverageIDs, validation.CoverageGate.RequirementIDs) {
		return diagnostic.New("AIDD_COVERAGE_INVENTORY", "validation.coverage_gate.coverage", artifact, "coverage must contain every Requirement ID in canonical order", validation.CoverageGate.RequirementIDs, coverageIDs)
	}
	return nil
}

func validateBehaviorEvidenceOwnership(behaviors []model.ProductBehavior, sections []model.Section, artifact string) error {
	owners := make(map[string]string, len(behaviors))
	expected := make([]string, len(behaviors))
	for index, behavior := range behaviors {
		owners[behavior.ID] = behavior.RequirementID
		expected[index] = behavior.ID
	}
	references := map[string]struct{}{}
	for _, section := range sections {
		for _, block := range section.Blocks {
			if block.Type != "evidence" || block.Role != "design" {
				continue
			}
			for _, behaviorID := range block.ProductBehaviorIDs {
				expectedOwner, exists := owners[behaviorID]
				if !exists || expectedOwner != block.OwnerID {
					return diagnostic.New("AIDD_BEHAVIOR_EVIDENCE_OWNER", block.ID+".product_behavior_ids", artifact, "design evidence behavior must exist and share the Requirement owner", expectedOwner, map[string]string{"behavior_id": behaviorID, "owner_id": block.OwnerID})
				}
				if _, duplicate := references[behaviorID]; duplicate {
					return diagnostic.New("AIDD_BEHAVIOR_EVIDENCE_DUPLICATE", block.ID+".product_behavior_ids", artifact, "each product behavior must have exactly one design evidence owner", "one design evidence reference", behaviorID)
				}
				references[behaviorID] = struct{}{}
			}
		}
	}
	actual := make([]string, 0, len(references))
	for _, behaviorID := range expected {
		if _, exists := references[behaviorID]; exists {
			actual = append(actual, behaviorID)
		}
	}
	if !equalStrings(actual, expected) {
		return diagnostic.New("AIDD_BEHAVIOR_EVIDENCE_INVENTORY", "validation.sections", artifact, "design evidence must exactly own every target product behavior", expected, actual)
	}
	return nil
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

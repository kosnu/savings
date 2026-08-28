package semantic

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

var lowerKebabPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

type sectionWire struct {
	ID      string            `json:"id"`
	Heading string            `json:"heading"`
	Blocks  []json.RawMessage `json:"blocks"`
}

type markdownBlockWire struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Markdown string `json:"markdown"`
}

type requirementsBlockWire struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type designEvidenceBlockWire struct {
	ID                 string   `json:"id"`
	Type               string   `json:"type"`
	Role               string   `json:"role"`
	OwnerID            string   `json:"owner_id"`
	Text               string   `json:"text"`
	ProductBehaviorIDs []string `json:"product_behavior_ids"`
}

type evidenceBlockWire struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	OwnerID string `json:"owner_id"`
	Text    string `json:"text"`
}

// DecodeSectionsは各blockの厳密なfield集合を検証してから、
// GateとMarkdown rendererが共有するsection modelを返す。
func DecodeSections(raw json.RawMessage, allowRequirements bool, artifact string) ([]model.Section, error) {
	var sectionWires []sectionWire
	if err := canonical.Decode(raw, artifact+".validation.sections", &sectionWires); err != nil {
		return nil, err
	}
	if len(sectionWires) == 0 {
		return nil, diagnostic.New("AIDD_SECTIONS_EMPTY", "validation.sections", artifact, "managed source sections must be non-empty", "non-empty section inventory", sectionWires)
	}
	sections := make([]model.Section, 0, len(sectionWires))
	sectionIDs := map[string]struct{}{}
	headings := map[string]struct{}{}
	blockIDs := map[string]struct{}{}
	for sectionIndex, wire := range sectionWires {
		path := fmt.Sprintf("validation.sections[%d]", sectionIndex)
		if !lowerKebabPattern.MatchString(wire.ID) {
			return nil, diagnostic.New("AIDD_SECTION_ID", path+".id", artifact, "section ID must use lowercase ASCII kebab-case", "lowercase ASCII kebab-case", wire.ID)
		}
		if _, duplicate := sectionIDs[wire.ID]; duplicate {
			return nil, diagnostic.New("AIDD_SECTION_DUPLICATE", path+".id", artifact, "section IDs must be unique", "unique ID", wire.ID)
		}
		if strings.TrimSpace(wire.Heading) == "" || strings.ContainsAny(wire.Heading, "\r\n") {
			return nil, diagnostic.New("AIDD_SECTION_HEADING", path+".heading", artifact, "section heading must be a non-empty single line", "non-empty single-line string", wire.Heading)
		}
		if _, duplicate := headings[wire.Heading]; duplicate {
			return nil, diagnostic.New("AIDD_SECTION_HEADING_DUPLICATE", path+".heading", artifact, "section headings must be unique", "unique heading", wire.Heading)
		}
		if len(wire.Blocks) == 0 {
			return nil, diagnostic.New("AIDD_SECTION_BLOCKS", path+".blocks", artifact, "section blocks must be non-empty", "non-empty block inventory", wire.Blocks)
		}
		section := model.Section{ID: wire.ID, Heading: wire.Heading}
		for blockIndex, rawBlock := range wire.Blocks {
			blockPath := fmt.Sprintf("%s.blocks[%d]", path, blockIndex)
			block, err := decodeBlock(rawBlock, allowRequirements, blockPath, artifact)
			if err != nil {
				return nil, err
			}
			if _, duplicate := blockIDs[block.ID]; duplicate {
				return nil, diagnostic.New("AIDD_BLOCK_DUPLICATE", blockPath+".id", artifact, "block IDs must be globally unique", "unique ID", block.ID)
			}
			blockIDs[block.ID] = struct{}{}
			section.Blocks = append(section.Blocks, block)
		}
		sectionIDs[wire.ID] = struct{}{}
		headings[wire.Heading] = struct{}{}
		sections = append(sections, section)
	}
	return sections, nil
}

func decodeBlock(raw json.RawMessage, allowRequirements bool, path, artifact string) (model.Block, error) {
	var discriminator struct {
		Type string `json:"type"`
		Role string `json:"role"`
	}
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return model.Block{}, diagnostic.New("AIDD_BLOCK_SHAPE", path, artifact, "block discriminator is invalid", []string{"markdown", "requirements", "evidence"}, err.Error())
	}
	var block model.Block
	switch discriminator.Type {
	case "markdown":
		if err := requireJSONFields(raw, path, artifact, "id", "type", "markdown"); err != nil {
			return model.Block{}, err
		}
		var wire markdownBlockWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.Block{}, err
		}
		if strings.TrimSpace(wire.Markdown) == "" {
			return model.Block{}, diagnostic.New("AIDD_MARKDOWN_BLOCK", path+".markdown", artifact, "markdown block must contain text", "non-empty string", wire.Markdown)
		}
		block = model.Block{ID: wire.ID, Type: wire.Type, Markdown: wire.Markdown}
	case "requirements":
		if !allowRequirements {
			return model.Block{}, diagnostic.New("AIDD_REQUIREMENTS_BLOCK", path+".type", artifact, "requirements blocks are only valid in Requirements sources", []string{"markdown", "evidence"}, discriminator.Type)
		}
		if err := requireJSONFields(raw, path, artifact, "id", "type"); err != nil {
			return model.Block{}, err
		}
		var wire requirementsBlockWire
		if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
			return model.Block{}, err
		}
		block = model.Block{ID: wire.ID, Type: wire.Type}
	case "evidence":
		switch discriminator.Role {
		case "design":
			if err := requireJSONFields(raw, path, artifact, "id", "type", "role", "owner_id", "text", "product_behavior_ids"); err != nil {
				return model.Block{}, err
			}
			var wire designEvidenceBlockWire
			if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
				return model.Block{}, err
			}
			if err := requireCanonicalIDs(wire.ProductBehaviorIDs, numberedSortKey("PB-"), "AIDD_EVIDENCE_BEHAVIORS", path+".product_behavior_ids", artifact); err != nil {
				return model.Block{}, err
			}
			block = model.Block{ID: wire.ID, Type: wire.Type, Role: wire.Role, OwnerID: wire.OwnerID, Text: wire.Text, ProductBehaviorIDs: wire.ProductBehaviorIDs}
		case "verification", "baseline":
			if err := requireJSONFields(raw, path, artifact, "id", "type", "role", "owner_id", "text"); err != nil {
				return model.Block{}, err
			}
			var wire evidenceBlockWire
			if err := canonical.Decode(raw, artifact+"."+path, &wire); err != nil {
				return model.Block{}, err
			}
			block = model.Block{ID: wire.ID, Type: wire.Type, Role: wire.Role, OwnerID: wire.OwnerID, Text: wire.Text}
		default:
			return model.Block{}, diagnostic.New("AIDD_EVIDENCE_ROLE", path+".role", artifact, "evidence role is unsupported", []string{"design", "verification", "baseline"}, discriminator.Role)
		}
		if strings.TrimSpace(block.OwnerID) == "" || strings.ContainsAny(block.OwnerID, "\r\n") || strings.ContainsAny(block.Text, "\r\n") || len([]rune(substantive(block.Text))) < 8 {
			return model.Block{}, diagnostic.New("AIDD_EVIDENCE_CONTENT", path, artifact, "evidence must have a single-line owner and substantive single-line text", "single-line owner_id and at least 8 substantive characters on one line", block)
		}
	default:
		return model.Block{}, diagnostic.New("AIDD_BLOCK_TYPE", path+".type", artifact, "block type is unsupported", []string{"markdown", "requirements", "evidence"}, discriminator.Type)
	}
	if !lowerKebabPattern.MatchString(block.ID) {
		return model.Block{}, diagnostic.New("AIDD_BLOCK_ID", path+".id", artifact, "block ID must use lowercase ASCII kebab-case", "lowercase ASCII kebab-case", block.ID)
	}
	return block, nil
}

// ValidateRequirementsStructureはcurrent sourceと互換Git HEAD baselineに共通する
// Requirementとsection/blockの文書内契約を検証する。
func ValidateRequirementsStructure(requirements []model.Requirement, sections []model.Section, artifact string) error {
	sectionIDs := make([]string, len(sections))
	sectionSet := make(map[string]struct{}, len(sections))
	requirementBlockCounts := make(map[string]int, len(sections))
	for index, section := range sections {
		sectionIDs[index] = section.ID
		sectionSet[section.ID] = struct{}{}
		for _, block := range section.Blocks {
			if block.Type == "requirements" {
				requirementBlockCounts[section.ID]++
			}
		}
	}
	requirementsPerSection := make(map[string]int, len(sections))
	for index, requirement := range requirements {
		if _, exists := sectionSet[requirement.SectionID]; !exists {
			return diagnostic.New("AIDD_REQUIREMENT_SECTION", fmt.Sprintf("validation.requirements[%d].section_id", index), artifact, "Requirement section_id must reference a current section", sectionIDs, requirement.SectionID)
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

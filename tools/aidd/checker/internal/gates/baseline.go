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
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
)

func validateSourceSections(sections []model.Section) ([]model.Section, map[string]model.Block, error) {
	blocks := map[string]model.Block{}
	for _, section := range sections {
		for _, block := range section.Blocks {
			blocks[block.ID] = block
		}
	}
	return sections, blocks, nil
}

func validateRequirementsSections(sections []model.Section, sectionContract *requirementscontract.Resolved, artifact string) ([]model.Section, map[string]model.Block, error) {
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

func requirementsSectionContents(sections []model.Section, requirements []model.Requirement) map[string]string {
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
	Blocks       []model.Block                 `json:"blocks"`
	Requirements []sectionRequirementHashEntry `json:"requirements"`
}

func requirementsSectionHash(section model.Section, requirements map[string]model.Requirement) (string, error) {
	ids := make([]string, 0, len(requirements))
	for id, requirement := range requirements {
		if requirement.SectionID == section.ID {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return semantic.RequirementIDLess(ids[i], ids[j]) })
	entries := make([]sectionRequirementHashEntry, len(ids))
	for index, id := range ids {
		entries[index] = sectionRequirementHashEntry{ID: id, Text: requirements[id].Text}
	}
	return canonical.Hash(requirementsSectionHashValue{Heading: section.Heading, Blocks: section.Blocks, Requirements: entries})
}

func validateBaseline(ctx context.Context, snapshot *repository.Snapshot, workspace string, baselineRecord model.Baseline, artifact string) error {
	_, err := validateArtifactBaseline(ctx, snapshot, workspace, "requirements.json", baselineRecord, artifact, "AIDD_REQUIREMENTS_BASELINE")
	return err
}

func validateArtifactBaseline(ctx context.Context, snapshot *repository.Snapshot, workspace, filename string, baselineRecord model.Baseline, artifact, code string) ([]byte, error) {
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
			return nil, diagnostic.New(code, "validation.baseline", artifact, "missing Git HEAD baseline must be represented as none", model.Baseline{Source: "none", BodySHA256: nil}, baselineRecord)
		}
		return nil, nil
	}
	digest := canonical.HashBytes(output)
	if baselineRecord.Source != "git_head" || baselineRecord.BodySHA256 == nil || !sha256Pattern.MatchString(*baselineRecord.BodySHA256) || *baselineRecord.BodySHA256 != digest {
		return nil, diagnostic.New(code, "validation.baseline", artifact, "existing Git HEAD baseline must be hash-fixed", map[string]any{"source": "git_head", "body_sha256": digest}, baselineRecord)
	}
	return output, nil
}

package requirementscontract

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"
)

const DefaultPath = "docs/ai-driven-development/contracts/requirements-sections.json"

var sectionIDPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type Section struct {
	ID       string   `json:"id"`
	Headings []string `json:"headings"`
}

type Source struct {
	SchemaVersion int       `json:"schema_version"`
	Sections      []Section `json:"sections"`
}

type Resolved struct {
	Path         string
	SHA256       string
	Sections     []Section
	IDs          []string
	headingOwner map[string]string
}

func Load(snapshot *repository.Snapshot) (*Resolved, error) {
	content, err := snapshot.Read(DefaultPath)
	if err != nil {
		return nil, err
	}
	var source Source
	if err := canonical.Decode(content, "requirements_section_contract", &source); err != nil {
		return nil, err
	}
	if source.SchemaVersion != 1 {
		return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_SCHEMA", "schema_version", "requirements_section_contract", "Requirements section contract schema is unsupported", 1, source.SchemaVersion)
	}
	if len(source.Sections) == 0 {
		return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", "sections", "requirements_section_contract", "Requirements section contract must define at least one section", "non-empty sections", source.Sections)
	}
	resolved := &Resolved{Path: DefaultPath, SHA256: canonical.HashBytes(content), Sections: source.Sections, headingOwner: map[string]string{}}
	seenIDs := map[string]struct{}{}
	for index, section := range source.Sections {
		path := "sections[" + strconv.Itoa(index) + "]"
		if !sectionIDPattern.MatchString(section.ID) {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", path+".id", "requirements_section_contract", "section ID must use lowercase ASCII kebab-case", "lowercase-kebab-case", section.ID)
		}
		if _, duplicate := seenIDs[section.ID]; duplicate {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", path+".id", "requirements_section_contract", "section IDs must be unique", "unique ID", section.ID)
		}
		if len(section.Headings) == 0 {
			return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", path+".headings", "requirements_section_contract", "section must define at least one heading", "non-empty headings", section.Headings)
		}
		seenIDs[section.ID] = struct{}{}
		resolved.IDs = append(resolved.IDs, section.ID)
		for headingIndex, heading := range section.Headings {
			normalized := NormalizeHeading(heading)
			if normalized == "" {
				return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", path+".headings["+strconv.Itoa(headingIndex)+"]", "requirements_section_contract", "heading alias must be substantive", "non-empty normalized heading", heading)
			}
			if owner, duplicate := resolved.headingOwner[normalized]; duplicate && owner != section.ID {
				return nil, diagnostic.New("AIDD_REQUIREMENTS_SECTION_CONTRACT", path+".headings["+strconv.Itoa(headingIndex)+"]", "requirements_section_contract", "normalized heading aliases must be globally unique", "unique heading alias", map[string]string{"heading": heading, "existing_owner": owner})
			}
			resolved.headingOwner[normalized] = section.ID
		}
	}
	return resolved, nil
}

func (resolved *Resolved) MatchHeading(sectionID, heading string) bool {
	return resolved != nil && resolved.headingOwner[NormalizeHeading(heading)] == sectionID
}

func NormalizeHeading(value string) string {
	return strings.Join(strings.Fields(cases.Fold().String(norm.NFKC.String(value))), " ")
}

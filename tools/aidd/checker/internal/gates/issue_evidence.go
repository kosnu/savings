package gates

import (
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"golang.org/x/text/cases"
)

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

func normalizeIssueEvidence(value string) string {
	fields := strings.FieldsFunc(value, unicode.IsSpace)
	return issueEvidenceFolder.String(strings.Join(fields, " "))
}

func validateOwnedTransitions(items []model.RequirementTransition, issueBody string, ownerContents map[string]string, artifact, ownerKind string) error {
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

func validateRetirementEvidence(item model.RequirementRetirement, issueBody, path, artifact string) error {
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

func validateExplicitSurface(rule rules.Rule, selection model.DirectRule, normalizedEvidence, path, artifact string) error {
	if !isNonDomainImplementationRule(rule) {
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

type directRuleSelection struct {
	Evidence string
	Match    model.RuleMatch
}

func directRuleIDsMatchingSelections(loaded *rules.Loaded, selections []directRuleSelection) map[string]struct{} {
	result := map[string]struct{}{}
	for _, id := range loaded.Order {
		rule := loaded.ByID[id]
		for _, selection := range selections {
			if ruleMatches(rule, selection.Match) && directRuleMatchesEvidence(rule, selection.Evidence) {
				result[id] = struct{}{}
				break
			}
		}
	}
	return result
}

func directRuleMatchesEvidence(rule rules.Rule, normalizedEvidence string) bool {
	if !isNonDomainImplementationRule(rule) {
		return true
	}
	for _, topic := range rule.AppliesTo.Topics {
		normalizedTopic := normalizeIssueEvidence(topic)
		if _, generic := genericImplementationTopics[normalizedTopic]; !generic && strings.Contains(normalizedEvidence, normalizedTopic) {
			return true
		}
	}
	return false
}

func isNonDomainImplementationRule(rule rules.Rule) bool {
	if strings.HasPrefix(rule.ID, "domain.") {
		return false
	}
	for _, pattern := range rule.AppliesTo.Paths {
		if strings.HasPrefix(pattern, "apps/") {
			return true
		}
	}
	return false
}

func validateTransition(item model.RequirementTransition, issueBody, artifact string) error {
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

func ruleMatches(rule rules.Rule, selection model.RuleMatch) bool {
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

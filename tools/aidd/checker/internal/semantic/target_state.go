package semantic

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/manualcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"
)

var (
	behaviorIDPattern     = regexp.MustCompile(`^PB-[1-9][0-9]*$`)
	caseIDPattern         = regexp.MustCompile(`^VC-[1-9][0-9]*$`)
	representationPattern = regexp.MustCompile(`^REP-[1-9][0-9]*$`)
)

func ValidateTargetState(target *model.TargetState, requirementIDs []string, artifact string) error {
	requirementSet := stringSet(requirementIDs)
	behaviorRequirements := map[string]string{}
	behaviorIDs := make([]string, 0, len(target.ProductBehaviors))
	behaviorSemantic := map[string]struct{}{}
	for index, behavior := range target.ProductBehaviors {
		path := "validation.target_state.product_behaviors[" + strconv.Itoa(index) + "]"
		if !behaviorIDPattern.MatchString(behavior.ID) {
			return diagnostic.New("AIDD_BEHAVIOR_ID", path+".id", artifact, "product behavior ID is invalid", "PB-number", behavior.ID)
		}
		if behavior.Type != "user_operation" && behavior.Type != "state_transition" {
			return diagnostic.New("AIDD_BEHAVIOR_TYPE", path+".type", artifact, "product behavior type is unsupported", []string{"user_operation", "state_transition"}, behavior.Type)
		}
		if len([]rune(substantive(behavior.Description))) < 8 {
			return diagnostic.New("AIDD_BEHAVIOR_DESCRIPTION", path+".description", artifact, "product behavior description must be substantive", "at least 8 substantive characters", behavior.Description)
		}
		if _, ok := requirementSet[behavior.RequirementID]; !ok {
			return diagnostic.New("AIDD_BEHAVIOR_OWNER", path+".requirement_id", artifact, "product behavior must reference a covered Requirement", requirementIDs, behavior.RequirementID)
		}
		semanticID := behavior.RequirementID + "\x00" + behavior.Type + "\x00" + substantive(behavior.Description)
		if _, exists := behaviorSemantic[semanticID]; exists {
			return diagnostic.New("AIDD_BEHAVIOR_DUPLICATE", path+".description", artifact, "product behavior descriptions must be unique per Requirement and type", "unique semantic identity", behavior.Description)
		}
		behaviorSemantic[semanticID] = struct{}{}
		behaviorIDs = append(behaviorIDs, behavior.ID)
		behaviorRequirements[behavior.ID] = behavior.RequirementID
	}
	if err := requireCanonicalIDs(behaviorIDs, numberedSortKey("PB-"), "AIDD_BEHAVIOR_ORDER", "validation.target_state.product_behaviors", artifact); err != nil {
		return err
	}

	caseIDs := make([]string, 0, len(target.VerificationCases))
	caseRequirements := map[string]string{}
	coveredRequirements := map[string]struct{}{}
	coveredBehaviors := map[string]struct{}{}
	for index, verificationCase := range target.VerificationCases {
		path := "validation.target_state.verification_cases[" + strconv.Itoa(index) + "]"
		if !caseIDPattern.MatchString(verificationCase.ID) {
			return diagnostic.New("AIDD_CASE_ID", path+".id", artifact, "verification case ID is invalid", "VC-number", verificationCase.ID)
		}
		if _, ok := requirementSet[verificationCase.RequirementID]; !ok {
			return diagnostic.New("AIDD_CASE_OWNER", path+".requirement_id", artifact, "verification case must reference a covered Requirement", requirementIDs, verificationCase.RequirementID)
		}
		if err := validateVerificationContract(verificationCase, path, artifact); err != nil {
			return err
		}
		if err := requireCanonicalIDs(verificationCase.ProductBehaviorIDs, numberedSortKey("PB-"), "AIDD_CASE_BEHAVIORS", path+".product_behavior_ids", artifact); err != nil {
			return err
		}
		for _, behaviorID := range verificationCase.ProductBehaviorIDs {
			owner, ok := behaviorRequirements[behaviorID]
			if !ok || owner != verificationCase.RequirementID {
				return diagnostic.New("AIDD_CASE_BEHAVIOR_OWNER", path+".product_behavior_ids", artifact, "verification case behavior references must exist and share the Requirement owner", verificationCase.RequirementID, behaviorID)
			}
			coveredBehaviors[behaviorID] = struct{}{}
		}
		caseIDs = append(caseIDs, verificationCase.ID)
		caseRequirements[verificationCase.ID] = verificationCase.RequirementID
		coveredRequirements[verificationCase.RequirementID] = struct{}{}
	}
	if err := requireCanonicalIDs(caseIDs, numberedSortKey("VC-"), "AIDD_CASE_ORDER", "validation.target_state.verification_cases", artifact); err != nil {
		return err
	}
	if !sameSet(coveredRequirements, requirementSet) {
		return diagnostic.New("AIDD_CASE_REQUIREMENT_COVERAGE", "validation.target_state.verification_cases", artifact, "verification cases must cover every Requirement", requirementIDs, sortedSet(coveredRequirements))
	}
	if !sameSet(coveredBehaviors, stringSet(behaviorIDs)) {
		return diagnostic.New("AIDD_CASE_BEHAVIOR_COVERAGE", "validation.target_state.verification_cases", artifact, "verification cases must cover every product behavior", behaviorIDs, sortedSet(coveredBehaviors))
	}

	if err := validateScopes(target.OwnershipScopes, artifact); err != nil {
		return err
	}
	if err := validateRepresentations(target, requirementSet, behaviorRequirements, caseRequirements, artifact); err != nil {
		return err
	}
	return nil
}

func validateVerificationContract(verificationCase model.VerificationCase, path, artifact string) error {
	switch verificationCase.Type {
	case "automated":
		if verificationCase.VerificationProfileID == "" || verificationCase.Selector == nil || verificationCase.Procedure != "" {
			return diagnostic.New("AIDD_AUTOMATED_CASE_SHAPE", path, artifact, "automated case must own only a profile ID and typed selector", "verification_profile_id and selector", verificationCase)
		}
		switch verificationCase.Selector.Kind {
		case "suite":
			if verificationCase.Selector.Path != "" || verificationCase.Selector.Name != "" {
				return diagnostic.New("AIDD_SUITE_SELECTOR", path+".selector", artifact, "suite selector must not name a test path or test name", model.Selector{Kind: "suite"}, verificationCase.Selector)
			}
		case "test_case":
			if _, err := pathcontract.ValidateRelativePath(verificationCase.Selector.Path); err != nil {
				return diagnostic.New("AIDD_TEST_SELECTOR_PATH", path+".selector.path", artifact, "test-case selector path is invalid", "canonical repository-relative path", verificationCase.Selector.Path)
			}
			if substantive(verificationCase.Selector.Name) == "" {
				return diagnostic.New("AIDD_TEST_SELECTOR_NAME", path+".selector.name", artifact, "test-case selector name must be substantive", nil, verificationCase.Selector.Name)
			}
		default:
			return diagnostic.New("AIDD_SELECTOR_KIND", path+".selector.kind", artifact, "selector kind is unsupported", []string{"suite", "test_case"}, verificationCase.Selector.Kind)
		}
	case "manual":
		if verificationCase.VerificationProfileID != "" || verificationCase.Selector != nil {
			return diagnostic.New("AIDD_MANUAL_CASE_SHAPE", path, artifact, "manual case must own only a procedure", "procedure without automated profile or selector", verificationCase)
		}
		if !manualcontract.ValidProcedure(verificationCase.Procedure) {
			return diagnostic.New("AIDD_MANUAL_PROCEDURE", path+".procedure", artifact, "manual procedure must be substantive", map[string]any{"minimum_substantive_runes": manualcontract.MinimumSubstantiveRunes}, verificationCase.Procedure)
		}
	default:
		return diagnostic.New("AIDD_CASE_TYPE", path+".type", artifact, "verification case type is unsupported", []string{"automated", "manual"}, verificationCase.Type)
	}
	return nil
}

func validateScopes(scopes []model.OwnershipScope, artifact string) error {
	if len(scopes) == 0 {
		return diagnostic.New("AIDD_SCOPE_EMPTY", "validation.target_state.ownership_scopes", artifact, "ownership scopes must be non-empty", nil, scopes)
	}
	forbiddenRoots := map[string]bool{"apps": true, "apps/web": true, "apps/api": true, "docs": true, ".agents": true, ".codex": true}
	paths := make([]string, 0, len(scopes))
	for index, scope := range scopes {
		path := "validation.target_state.ownership_scopes[" + strconv.Itoa(index) + "]"
		if _, err := pathcontract.ValidateRelativePath(scope.Path); err != nil {
			return diagnostic.New("AIDD_SCOPE_PATH", path+".path", artifact, "ownership scope path is invalid", "canonical repository-relative path", scope.Path)
		}
		if scope.Kind != "file" && scope.Kind != "tree" {
			return diagnostic.New("AIDD_SCOPE_KIND", path+".kind", artifact, "ownership scope kind is unsupported", []string{"file", "tree"}, scope.Kind)
		}
		if scope.Kind == "tree" && forbiddenRoots[scope.Path] {
			return diagnostic.New("AIDD_SCOPE_BROAD", path+".path", artifact, "tree ownership scope is too broad", nil, scope.Path)
		}
		paths = append(paths, scope.Path)
	}
	canonicalPaths := append([]string(nil), paths...)
	sort.Strings(canonicalPaths)
	if !equalStrings(paths, uniqueStrings(canonicalPaths)) {
		return diagnostic.New("AIDD_SCOPE_ORDER", "validation.target_state.ownership_scopes", artifact, "ownership scopes must be unique and sorted", uniqueStrings(canonicalPaths), paths)
	}
	for index, scope := range scopes {
		for _, previous := range scopes[:index] {
			if withinScope(scope.Path, previous) || withinScope(previous.Path, scope) {
				return diagnostic.New("AIDD_SCOPE_OVERLAP", "validation.target_state.ownership_scopes", artifact, "ownership scopes must not overlap", nil, []string{previous.Path, scope.Path})
			}
		}
	}
	return nil
}

func validateRepresentations(target *model.TargetState, requirementSet map[string]struct{}, behaviorRequirements, caseRequirements map[string]string, artifact string) error {
	if len(target.Representations) == 0 {
		return diagnostic.New("AIDD_REPRESENTATION_EMPTY", "validation.target_state.representations", artifact, "representations must be non-empty", nil, target.Representations)
	}
	supportedKinds := map[string]bool{"implementation": true, "test": true, "story": true, "fixture": true, "configuration": true, "migration": true, "documentation": true}
	ids := make([]string, 0, len(target.Representations))
	locators := map[string]struct{}{}
	coveredBehaviors := map[string]struct{}{}
	coveredCases := map[string]struct{}{}
	for index, representation := range target.Representations {
		path := "validation.target_state.representations[" + strconv.Itoa(index) + "]"
		if !representationPattern.MatchString(representation.ID) {
			return diagnostic.New("AIDD_REPRESENTATION_ID", path+".id", artifact, "representation ID is invalid", "REP-number", representation.ID)
		}
		if !supportedKinds[representation.Kind] {
			return diagnostic.New("AIDD_REPRESENTATION_KIND", path+".kind", artifact, "representation kind is unsupported", nil, representation.Kind)
		}
		if _, err := pathcontract.ValidateRelativePath(representation.Path); err != nil {
			return diagnostic.New("AIDD_REPRESENTATION_PATH", path+".path", artifact, "representation path is invalid", "canonical repository-relative path", representation.Path)
		}
		owned := false
		for _, scope := range target.OwnershipScopes {
			if withinScope(representation.Path, scope) {
				owned = true
				break
			}
		}
		if !owned {
			return diagnostic.New("AIDD_REPRESENTATION_SCOPE", path+".path", artifact, "representation path must be inside an ownership scope", target.OwnershipScopes, representation.Path)
		}
		if _, ok := requirementSet[representation.RequirementID]; !ok {
			return diagnostic.New("AIDD_REPRESENTATION_OWNER", path+".requirement_id", artifact, "representation must reference a covered Requirement", sortedSet(requirementSet), representation.RequirementID)
		}
		if representation.Locator.Kind != "file" && representation.Locator.Kind != "export" && representation.Locator.Kind != "test_case" {
			return diagnostic.New("AIDD_LOCATOR_KIND", path+".locator.kind", artifact, "representation locator kind is unsupported", []string{"file", "export", "test_case"}, representation.Locator.Kind)
		}
		if representation.Locator.Kind == "file" && representation.Locator.Name != "" {
			return diagnostic.New("AIDD_LOCATOR_NAME", path+".locator.name", artifact, "file locator must not own a name", "", representation.Locator.Name)
		}
		if representation.Locator.Kind != "file" && substantive(representation.Locator.Name) == "" {
			return diagnostic.New("AIDD_LOCATOR_NAME", path+".locator.name", artifact, "named locator must own a substantive name", nil, representation.Locator.Name)
		}
		locatorIdentity := representation.Path + "\x00" + representation.Locator.Kind + "\x00" + representation.Locator.Name
		if _, exists := locators[locatorIdentity]; exists {
			return diagnostic.New("AIDD_LOCATOR_DUPLICATE", path+".locator", artifact, "representation locator identity must be unique", "unique path/kind/name", locatorIdentity)
		}
		locators[locatorIdentity] = struct{}{}
		if err := requireCanonicalIDs(representation.ProductBehaviorIDs, numberedSortKey("PB-"), "AIDD_REPRESENTATION_BEHAVIORS", path+".product_behavior_ids", artifact); err != nil {
			return err
		}
		for _, behaviorID := range representation.ProductBehaviorIDs {
			if behaviorRequirements[behaviorID] != representation.RequirementID {
				return diagnostic.New("AIDD_REPRESENTATION_BEHAVIOR_OWNER", path+".product_behavior_ids", artifact, "representation behaviors must exist and share the Requirement owner", representation.RequirementID, behaviorID)
			}
			coveredBehaviors[behaviorID] = struct{}{}
		}
		if err := requireCanonicalIDs(representation.VerificationCaseIDs, numberedSortKey("VC-"), "AIDD_REPRESENTATION_CASES", path+".verification_case_ids", artifact); err != nil {
			return err
		}
		for _, caseID := range representation.VerificationCaseIDs {
			if caseRequirements[caseID] != representation.RequirementID {
				return diagnostic.New("AIDD_REPRESENTATION_CASE_OWNER", path+".verification_case_ids", artifact, "representation verification cases must exist and share the Requirement owner", representation.RequirementID, caseID)
			}
			coveredCases[caseID] = struct{}{}
		}
		ids = append(ids, representation.ID)
	}
	if err := requireCanonicalIDs(ids, numberedSortKey("REP-"), "AIDD_REPRESENTATION_ORDER", "validation.target_state.representations", artifact); err != nil {
		return err
	}
	if !sameSet(coveredBehaviors, stringSet(keys(behaviorRequirements))) {
		return diagnostic.New("AIDD_REPRESENTATION_BEHAVIOR_COVERAGE", "validation.target_state.representations", artifact, "representations must cover every product behavior", keys(behaviorRequirements), sortedSet(coveredBehaviors))
	}
	if !sameSet(coveredCases, stringSet(keys(caseRequirements))) {
		return diagnostic.New("AIDD_REPRESENTATION_CASE_COVERAGE", "validation.target_state.representations", artifact, "representations must cover every verification case", keys(caseRequirements), sortedSet(coveredCases))
	}
	return nil
}

func ValidateProfiles(target *model.TargetState, resolved *catalog.Resolved, artifact string) ([]model.SelectedProfile, error) {
	selected, err := catalog.Resolve(resolved, target.VerificationCases)
	if err != nil {
		if item, ok := err.(*diagnostic.Diagnostic); ok && item.Artifact == "target_state" {
			item.Artifact = artifact
		}
		return nil, err
	}
	return selected, nil
}

func withinScope(path string, scope model.OwnershipScope) bool {
	return path == scope.Path || (scope.Kind == "tree" && strings.HasPrefix(path, scope.Path+"/"))
}

func substantive(value string) string {
	var builder strings.Builder
	for _, character := range cases.Fold().String(norm.NFKC.String(strings.TrimSpace(value))) {
		if unicode.IsPunct(character) || unicode.IsSymbol(character) || unicode.IsSpace(character) || unicode.IsControl(character) || unicode.IsMark(character) {
			continue
		}
		builder.WriteRune(character)
	}
	return builder.String()
}

func requireCanonicalIDs(ids []string, key func(string) int, code, path, artifact string) error {
	canonicalIDs := append([]string(nil), ids...)
	sort.Slice(canonicalIDs, func(i, j int) bool { return key(canonicalIDs[i]) < key(canonicalIDs[j]) })
	canonicalIDs = uniqueStrings(canonicalIDs)
	if !equalStrings(ids, canonicalIDs) {
		return diagnostic.New(code, path, artifact, "IDs must be unique and in canonical numeric order", canonicalIDs, ids)
	}
	return nil
}

func requirementSortKey(value string) int {
	prefixWeight := map[string]int{"FR": 0, "NFR": 1, "AC": 2}
	parts := strings.Split(value, "-")
	if len(parts) != 2 {
		return 1 << 30
	}
	number, _ := strconv.Atoi(parts[1])
	return prefixWeight[parts[0]]*1_000_000 + number
}

func numberedSortKey(prefix string) func(string) int {
	return func(value string) int {
		number, err := strconv.Atoi(strings.TrimPrefix(value, prefix))
		if err != nil || !strings.HasPrefix(value, prefix) {
			return 1 << 30
		}
		return number
	}
}

func stringSet(values []string) map[string]struct{} {
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		result[value] = struct{}{}
	}
	return result
}

func sameSet(left, right map[string]struct{}) bool {
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

func sortedSet(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func keys[T any](values map[string]T) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return values
	}
	result := values[:0]
	for _, value := range values {
		if len(result) == 0 || result[len(result)-1] != value {
			result = append(result, value)
		}
	}
	return result
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

package rules

import (
	"encoding/json"
	"path"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

type RuleMap struct {
	Version         int           `json:"version,omitempty"`
	Description     string        `json:"description,omitempty"`
	ResolutionOrder []string      `json:"resolution_order,omitempty"`
	ReviewRouting   ReviewRouting `json:"review_routing"`
	Rules           []Rule        `json:"rules"`
}

type ReviewRouting struct {
	GovernedPaths []string  `json:"governed_paths"`
	Surfaces      []Surface `json:"surfaces"`
}

type Surface struct {
	ID            string   `json:"id"`
	Paths         []string `json:"paths"`
	RequiredRules []string `json:"required_rules"`
}

type Rule struct {
	ID        string    `json:"id"`
	File      string    `json:"file"`
	AppliesTo AppliesTo `json:"applies_to"`
	DependsOn []string  `json:"depends_on"`
	Related   []string  `json:"related,omitempty"`
	Overrides []string  `json:"overrides"`
	Priority  int       `json:"priority"`
}

type AppliesTo struct {
	Paths      []string `json:"paths"`
	Domains    []string `json:"domains"`
	Activities []string `json:"activities"`
	Topics     []string `json:"topics"`
}

type Loaded struct {
	Path   string
	SHA256 string
	Map    RuleMap
	ByID   map[string]Rule
	Order  []string
}

func Load(snapshot *repository.Snapshot, ruleMapPath string) (*Loaded, error) {
	content, err := snapshot.Read(ruleMapPath)
	if err != nil {
		return nil, err
	}
	var ruleMap RuleMap
	if err := canonical.Decode(content, "rule_map", &ruleMap); err != nil {
		return nil, err
	}
	if ruleMap.Version != 2 {
		return nil, diagnostic.New("AIDD_RULE_MAP_VERSION", "version", "rule_map", "rule-map version is unsupported", 2, ruleMap.Version)
	}
	for index, pattern := range ruleMap.ReviewRouting.GovernedPaths {
		if err := validatePattern(pattern, "review_routing.governed_paths", index); err != nil {
			return nil, err
		}
	}
	surfaceIDs := map[string]struct{}{}
	for index, surface := range ruleMap.ReviewRouting.Surfaces {
		if surface.ID == "" {
			return nil, diagnostic.New("AIDD_SURFACE_ID", "review_routing.surfaces", "rule_map", "surface ID is required", nil, index)
		}
		if _, duplicate := surfaceIDs[surface.ID]; duplicate {
			return nil, diagnostic.New("AIDD_SURFACE_DUPLICATE", "review_routing.surfaces", "rule_map", "surface IDs must be unique", "unique ID", surface.ID)
		}
		surfaceIDs[surface.ID] = struct{}{}
		for patternIndex, pattern := range surface.Paths {
			if err := validatePattern(pattern, "review_routing.surfaces."+surface.ID+".paths", patternIndex); err != nil {
				return nil, err
			}
		}
	}
	byID := make(map[string]Rule, len(ruleMap.Rules))
	order := make([]string, 0, len(ruleMap.Rules))
	for index, rule := range ruleMap.Rules {
		if rule.ID == "" || rule.File == "" {
			return nil, diagnostic.New("AIDD_RULE_SHAPE", "rules", "rule_map", "rule ID and file are required", nil, index)
		}
		if _, exists := byID[rule.ID]; exists {
			return nil, diagnostic.New("AIDD_RULE_DUPLICATE", "rules", "rule_map", "rule IDs must be unique", "unique ID", rule.ID)
		}
		if _, err := repository.ValidateRelativePath(rule.File); err != nil {
			return nil, diagnostic.New("AIDD_RULE_FILE", "rules."+rule.ID+".file", "rule_map", "rule file path is invalid", "canonical repository-relative path", rule.File)
		}
		for patternIndex, pattern := range rule.AppliesTo.Paths {
			if err := validatePattern(pattern, "rules."+rule.ID+".applies_to.paths", patternIndex); err != nil {
				return nil, err
			}
		}
		byID[rule.ID] = rule
		order = append(order, rule.ID)
	}
	for _, rule := range ruleMap.Rules {
		for _, dependency := range rule.DependsOn {
			if _, exists := byID[dependency]; !exists {
				return nil, diagnostic.New("AIDD_RULE_DEPENDENCY", "rules."+rule.ID+".depends_on", "rule_map", "rule dependency is unknown", nil, dependency)
			}
		}
	}
	for _, surface := range ruleMap.ReviewRouting.Surfaces {
		for _, ruleID := range surface.RequiredRules {
			if _, exists := byID[ruleID]; !exists {
				return nil, diagnostic.New("AIDD_SURFACE_RULE", "review_routing.surfaces."+surface.ID+".required_rules", "rule_map", "surface requires an unknown rule", nil, ruleID)
			}
		}
	}
	loaded := &Loaded{Path: ruleMapPath, SHA256: canonical.HashBytes(content), Map: ruleMap, ByID: byID, Order: order}
	allRules := map[string]struct{}{}
	for id := range byID {
		allRules[id] = struct{}{}
	}
	if _, err := ExpandClosure(loaded, allRules); err != nil {
		return nil, err
	}
	return loaded, nil
}

func validatePattern(pattern, owner string, index int) error {
	if pattern == "" || strings.Contains(pattern, "\\") || strings.HasPrefix(pattern, "/") || strings.HasSuffix(pattern, "/") {
		return diagnostic.New("AIDD_RULE_PATTERN", owner, "rule_map", "path pattern must be a non-empty repository-relative slash pattern", nil, pattern)
	}
	for _, segment := range strings.Split(pattern, "/") {
		if segment == "" {
			return diagnostic.New("AIDD_RULE_PATTERN", owner, "rule_map", "path pattern must not contain empty segments", nil, map[string]any{"index": index, "pattern": pattern})
		}
		if segment == ".." {
			return diagnostic.New("AIDD_RULE_PATTERN", owner, "rule_map", "path pattern contains a forbidden segment", nil, map[string]any{"index": index, "pattern": pattern})
		}
		if strings.Contains(segment, "**") && segment != "**" {
			return diagnostic.New("AIDD_RULE_PATTERN", owner, "rule_map", "double-star must occupy a complete path segment", "** as a complete segment", map[string]any{"index": index, "pattern": pattern})
		}
		if segment == "**" {
			continue
		}
		if _, err := path.Match(segment, "probe"); err != nil {
			return diagnostic.New("AIDD_RULE_PATTERN", owner, "rule_map", "path pattern contains malformed syntax", "valid path.Match segment", map[string]any{"index": index, "pattern": pattern})
		}
	}
	return nil
}

func SelectedIDs(requirementsContent, designContent []byte, loaded *Loaded) ([]string, error) {
	direct := map[string]struct{}{}
	var requirements map[string]any
	if err := json.Unmarshal(requirementsContent, &requirements); err != nil {
		return nil, err
	}
	collectRequirementRules(requirements, direct)
	var design model.Source
	if err := json.Unmarshal(designContent, &design); err != nil {
		return nil, err
	}
	var validation model.DesignValidation
	if err := json.Unmarshal(design.Validation, &validation); err != nil {
		return nil, err
	}
	for _, surfaceID := range validation.RuleCoverage.ImplementationSurfaces {
		found := false
		for _, surface := range loaded.Map.ReviewRouting.Surfaces {
			if surface.ID != surfaceID {
				continue
			}
			found = true
			for _, ruleID := range surface.RequiredRules {
				direct[ruleID] = struct{}{}
			}
		}
		if !found {
			return nil, diagnostic.New("AIDD_SURFACE_UNKNOWN", "validation.rule_coverage.implementation_surfaces", "design", "implementation surface is not present in rule-map", nil, surfaceID)
		}
	}
	for _, additional := range validation.RuleCoverage.AdditionalRules {
		direct[additional.ID] = struct{}{}
	}
	closure, err := ExpandClosure(loaded, direct)
	if err != nil {
		return nil, err
	}
	return orderedSelection(loaded.Order, closure), nil
}

func ExpandClosure(loaded *Loaded, direct map[string]struct{}) (map[string]struct{}, error) {
	closure := map[string]struct{}{}
	visiting := map[string]bool{}
	var visit func(string) error
	visit = func(id string) error {
		if _, done := closure[id]; done {
			return nil
		}
		if visiting[id] {
			return diagnostic.New("AIDD_RULE_CYCLE", "rules."+id, "rule_map", "rule dependency graph contains a cycle", nil, id)
		}
		rule, exists := loaded.ByID[id]
		if !exists {
			return diagnostic.New("AIDD_RULE_UNKNOWN", "selected_rules", "rule_map", "selected rule is unknown", nil, id)
		}
		visiting[id] = true
		for _, dependency := range rule.DependsOn {
			if err := visit(dependency); err != nil {
				return err
			}
		}
		delete(visiting, id)
		closure[id] = struct{}{}
		return nil
	}
	directIDs := make([]string, 0, len(direct))
	for id := range direct {
		directIDs = append(directIDs, id)
	}
	sort.Strings(directIDs)
	for _, id := range directIDs {
		if err := visit(id); err != nil {
			return nil, err
		}
	}
	return closure, nil
}

func ResolvePath(loaded *Loaded, repositoryPath string) ([]string, []string, error) {
	surfaces := []string{}
	direct := map[string]struct{}{}
	governed := matchesAny(loaded.Map.ReviewRouting.GovernedPaths, repositoryPath)
	for _, surface := range loaded.Map.ReviewRouting.Surfaces {
		if !matchesAny(surface.Paths, repositoryPath) {
			continue
		}
		surfaces = append(surfaces, surface.ID)
		for _, ruleID := range surface.RequiredRules {
			direct[ruleID] = struct{}{}
		}
	}
	if governed && len(surfaces) == 0 {
		return nil, nil, diagnostic.New("AIDD_GOVERNED_PATH_UNROUTED", repositoryPath, "rule_map", "governed path does not match a review surface", "at least one surface", repositoryPath)
	}
	for _, rule := range loaded.Map.Rules {
		if matchesAny(rule.AppliesTo.Paths, repositoryPath) {
			direct[rule.ID] = struct{}{}
		}
	}
	closure, err := ExpandClosure(loaded, direct)
	if err != nil {
		return nil, nil, err
	}
	return surfaces, orderedSelection(loaded.Order, closure), nil
}

func collectRequirementRules(source map[string]any, selected map[string]struct{}) {
	validation, _ := source["validation"].(map[string]any)
	inputGate, _ := validation["input_gate"].(map[string]any)
	for _, field := range []string{"direct_rules", "depends_on"} {
		entries, _ := inputGate[field].([]any)
		for _, value := range entries {
			entry, _ := value.(map[string]any)
			id, _ := entry["id"].(string)
			if id != "" {
				selected[id] = struct{}{}
			}
		}
	}
}

func orderedSelection(order []string, selected map[string]struct{}) []string {
	result := make([]string, 0, len(selected))
	for _, id := range order {
		if _, ok := selected[id]; ok {
			result = append(result, id)
		}
	}
	return result
}

func matchesAny(patterns []string, repositoryPath string) bool {
	for _, pattern := range patterns {
		if matchSegments(strings.Split(pattern, "/"), strings.Split(repositoryPath, "/")) {
			return true
		}
	}
	return false
}

func matchSegments(pattern, value []string) bool {
	if len(pattern) == 0 {
		return len(value) == 0
	}
	if pattern[0] == "**" {
		if matchSegments(pattern[1:], value) {
			return true
		}
		return len(value) > 0 && matchSegments(pattern, value[1:])
	}
	if len(value) == 0 {
		return false
	}
	matched, err := path.Match(pattern[0], value[0])
	return err == nil && matched && matchSegments(pattern[1:], value[1:])
}

func Sorted(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

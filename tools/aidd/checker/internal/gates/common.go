package gates

import (
	"sort"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
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

func SortedTransitions(values []model.RequirementTransition) []model.RequirementTransition {
	result := append([]model.RequirementTransition(nil), values...)
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result
}

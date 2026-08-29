package runner

import (
	"fmt"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/manualcontract"
)

func ParseManualObservations(values []string) (map[string]string, error) {
	result := map[string]string{}
	for _, value := range values {
		id, observation, found := strings.Cut(value, "=")
		if !found || id == "" || !manualcontract.ValidObservation(observation) {
			return nil, fmt.Errorf("manual observation must use VC-ID=text with at least %d substantive characters on one line", manualcontract.MinimumSubstantiveRunes)
		}
		if _, duplicate := result[id]; duplicate {
			return nil, fmt.Errorf("manual observation ID must be unique: %s", id)
		}
		result[id] = observation
	}
	return result, nil
}

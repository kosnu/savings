package manualcontract

import (
	"strings"
	"unicode"
)

const MinimumSubstantiveRunes = 8

func ValidProcedure(value string) bool {
	return substantiveRunes(value) >= MinimumSubstantiveRunes
}

func ValidObservation(value string) bool {
	return !strings.ContainsAny(value, "\r\n") && substantiveRunes(value) >= MinimumSubstantiveRunes
}

func substantiveRunes(value string) int {
	count := 0
	for _, character := range strings.TrimSpace(value) {
		if unicode.IsPunct(character) || unicode.IsSymbol(character) || unicode.IsSpace(character) || unicode.IsControl(character) || unicode.IsMark(character) {
			continue
		}
		count++
	}
	return count
}

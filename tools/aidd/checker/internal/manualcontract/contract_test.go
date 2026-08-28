package manualcontract

import "testing"

func TestManualTextRequiresEightSubstantiveRunes(t *testing.T) {
	for name, value := range map[string]string{
		"single character": "x",
		"seven runes":      "確認結果は正常",
		"punctuation only": "...（！）...",
		"whitespace only":  " \t ",
	} {
		t.Run(name, func(t *testing.T) {
			if ValidProcedure(value) {
				t.Fatalf("ValidProcedure(%q) = true, want false", value)
			}
			if ValidObservation(value) {
				t.Fatalf("ValidObservation(%q) = true, want false", value)
			}
		})
	}
	valid := "画面表示が崩れていないことを確認した"
	if !ValidProcedure(valid) || !ValidObservation(valid) {
		t.Fatalf("substantive Japanese text must be valid: %q", valid)
	}
}

func TestObservationMustBeSingleLine(t *testing.T) {
	value := "画面表示が崩れていないことを\n確認した"
	if !ValidProcedure(value) {
		t.Fatal("multiline procedure should retain the shared substantive contract")
	}
	if ValidObservation(value) {
		t.Fatal("multiline observation must be rejected")
	}
}

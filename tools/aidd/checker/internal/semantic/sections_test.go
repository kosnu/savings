package semantic

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDecodeSectionsRejectsCrossVariantFieldsIncludingZeroValues(t *testing.T) {
	tests := []struct {
		name              string
		allowRequirements bool
		block             map[string]any
	}{
		{
			name:              "markdown owner",
			allowRequirements: true,
			block: map[string]any{
				"id": "body", "type": "markdown", "markdown": "本文を記録する。", "owner_id": "",
			},
		},
		{
			name:              "requirements markdown",
			allowRequirements: true,
			block: map[string]any{
				"id": "requirements", "type": "requirements", "markdown": "",
			},
		},
		{
			name: "verification behaviors",
			block: map[string]any{
				"id": "verification", "type": "evidence", "role": "verification", "owner_id": "FR-1", "text": "検証根拠を十分に記録する。", "product_behavior_ids": []any{},
			},
		},
		{
			name: "baseline behaviors null",
			block: map[string]any{
				"id": "baseline", "type": "evidence", "role": "baseline", "owner_id": "section", "text": "基準根拠を十分に記録する。", "product_behavior_ids": nil,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			raw, err := json.Marshal([]any{map[string]any{
				"id": "section", "heading": "Section", "blocks": []any{test.block},
			}})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := DecodeSections(raw, test.allowRequirements, "fixture"); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
				t.Fatalf("expected strict block variant rejection, got %v", err)
			}
		})
	}
}

func TestDecodeSectionsRequiresDesignBehaviorInventoryField(t *testing.T) {
	raw := []byte(`[{"id":"section","heading":"Section","blocks":[{"id":"design","type":"evidence","role":"design","owner_id":"FR-1","text":"設計根拠を十分に記録する。"}]}]`)
	if _, err := DecodeSections(raw, false, "fixture"); err == nil || !strings.Contains(err.Error(), "AIDD_JSON_SHAPE") {
		t.Fatalf("expected required product_behavior_ids rejection, got %v", err)
	}
}

func TestDecodeSectionsRejectsMultilineRendererBoundFields(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		code string
	}{
		{
			name: "heading",
			raw:  `[{"id":"section","heading":"Heading\nInjected","blocks":[{"id":"body","type":"markdown","markdown":"本文"}]}]`,
			code: "AIDD_SECTION_HEADING",
		},
		{
			name: "evidence owner",
			raw:  `[{"id":"section","heading":"Heading","blocks":[{"id":"design","type":"evidence","role":"design","owner_id":"FR-1\nFR-2","text":"設計根拠を十分に記録する。","product_behavior_ids":["PB-1"]}]}]`,
			code: "AIDD_EVIDENCE_CONTENT",
		},
		{
			name: "evidence text",
			raw:  `[{"id":"section","heading":"Heading","blocks":[{"id":"design","type":"evidence","role":"design","owner_id":"FR-1","text":"設計根拠を記録する。\n## Injected","product_behavior_ids":["PB-1"]}]}]`,
			code: "AIDD_EVIDENCE_CONTENT",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := DecodeSections([]byte(test.raw), false, "fixture"); err == nil || !strings.Contains(err.Error(), test.code) {
				t.Fatalf("expected %s, got %v", test.code, err)
			}
		})
	}
}

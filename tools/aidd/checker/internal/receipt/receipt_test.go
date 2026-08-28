package receipt

import (
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
)

func TestReceiptCanonicalGolden(t *testing.T) {
	value := model.Receipt{
		SchemaVersion: model.ReceiptSchemaVersion,
		Kind:          "design_completion",
		Workspace:     "1671-checker",
		Issue: model.IssueReceipt{
			ID: "owner/repo#1671", Title: "AIDD Checker", URL: "https://example.invalid/1671",
			UpdatedAt: "2026-08-28T00:00:00Z", BodySHA256: "body-hash",
		},
		TargetState:       model.HashValue[model.TargetState]{SHA256: "target-hash", Value: model.TargetState{}},
		OwnershipScopes:   model.HashValue[[]model.OwnershipScope]{SHA256: "scope-hash", Value: []model.OwnershipScope{}},
		BaselineInventory: model.HashValue[[]string]{SHA256: "inventory-hash", Value: []string{}},
		BuildBaseline:     model.BuildBaseline{Head: "0123456789012345678901234567890123456789"},
	}
	digest, err := canonical.Hash(value)
	if err != nil {
		t.Fatal(err)
	}
	const expected = "11226f9b1858676ce04e3c26e7a685334f0b4fefc8739e59aa15dda3e8503098"
	if digest != expected {
		t.Fatalf("receipt canonical golden = %s, want %s", digest, expected)
	}
}

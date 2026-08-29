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
		UntrackedBaseline: model.HashValue[[]model.UntrackedEntry]{SHA256: "untracked-hash", Value: []model.UntrackedEntry{}},
		BuildBaseline:     model.BuildBaseline{Head: "0123456789012345678901234567890123456789"},
		Artifacts: model.ReceiptArtifacts{
			Requirements: model.ArtifactPair{
				Source:  model.ArtifactIdentity{Path: "requirements.json", SHA256: "requirements-source-hash", Mode: "0644"},
				Display: model.ArtifactIdentity{Path: "requirements.md", SHA256: "requirements-display-hash", Mode: "0644"},
			},
			Design: model.ArtifactPair{
				Source:  model.ArtifactIdentity{Path: "design-doc.json", SHA256: "design-source-hash", Mode: "0644"},
				Display: model.ArtifactIdentity{Path: "design-doc.md", SHA256: "design-display-hash", Mode: "0644"},
			},
		},
	}
	digest, err := canonical.Hash(value)
	if err != nil {
		t.Fatal(err)
	}
	const expected = "05acd74a5f2bbc5ae92f4f9e5172fa4ad8fe8e1a5755f7ddbfac79ce974d9cdc"
	if digest != expected {
		t.Fatalf("receipt canonical golden = %s, want %s", digest, expected)
	}
}

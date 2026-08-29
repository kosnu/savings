package receipt

import (
	"context"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/semantic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

var (
	digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	commitPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)
)

type Loaded struct {
	Value   model.Receipt
	Bytes   []byte
	SHA256  string
	Catalog *catalog.Resolved
}

func Path(workspace string) (string, error) {
	return repository.WorkspacePath(workspace, ".aidd/design-completion.json")
}

func Load(ctx context.Context, snapshot *repository.Snapshot, workspace, expectedSHA256 string) (*Loaded, error) {
	if !digestPattern.MatchString(expectedSHA256) {
		return nil, diagnostic.New("AIDD_RECEIPT_EXPECTED_HASH", "expected_receipt_sha256", "design_completion", "expected receipt hash must be a lowercase SHA-256 digest", nil, expectedSHA256)
	}
	if _, err := snapshot.Head(ctx); err != nil {
		return nil, err
	}
	if err := snapshot.PinGitIndex(ctx); err != nil {
		return nil, err
	}
	path, err := Path(workspace)
	if err != nil {
		return nil, err
	}
	content, err := snapshot.Read(path)
	if err != nil {
		return nil, err
	}
	actualSHA256 := canonical.HashBytes(content)
	if actualSHA256 != expectedSHA256 {
		return nil, diagnostic.New("AIDD_RECEIPT_HASH", path, "design_completion", "receipt bytes do not match the Design completion evidence", expectedSHA256, actualSHA256)
	}
	var value model.Receipt
	if err := canonical.Decode(content, "design_completion", &value); err != nil {
		return nil, err
	}
	if value.SchemaVersion != model.ReceiptSchemaVersion || value.Kind != "design_completion" || value.Workspace != workspace {
		return nil, diagnostic.New("AIDD_RECEIPT_IDENTITY", "", "design_completion", "receipt identity is invalid", map[string]any{"schema_version": model.ReceiptSchemaVersion, "kind": "design_completion", "workspace": workspace}, map[string]any{"schema_version": value.SchemaVersion, "kind": value.Kind, "workspace": value.Workspace})
	}
	if !commitPattern.MatchString(value.BuildBaseline.Head) {
		return nil, diagnostic.New("AIDD_BUILD_BASELINE", "build_baseline.head", "design_completion", "receipt Build baseline must be a full lowercase Git commit ID", "40 lowercase hexadecimal characters", value.BuildBaseline.Head)
	}
	if err := AssertBuildHead(ctx, snapshot, value.BuildBaseline.Head); err != nil {
		return nil, err
	}
	if err := requireHashValue("target_state", value.TargetState.SHA256, value.TargetState.Value); err != nil {
		return nil, err
	}
	if err := requireHashValue("ownership_scopes", value.OwnershipScopes.SHA256, value.OwnershipScopes.Value); err != nil {
		return nil, err
	}
	if err := requireHashValue("baseline_inventory", value.BaselineInventory.SHA256, value.BaselineInventory.Value); err != nil {
		return nil, err
	}
	if value.UntrackedBaseline.SHA256 == "" || value.UntrackedBaseline.Value == nil {
		return nil, diagnostic.New("AIDD_RECEIPT_UNTRACKED_BASELINE", "untracked_baseline", "design_completion", "receipt must contain a hash-fixed non-ignored untracked baseline captured at Design completion", "recaptured Design completion receipt", nil)
	}
	if err := requireHashValue("untracked_baseline", value.UntrackedBaseline.SHA256, value.UntrackedBaseline.Value); err != nil {
		return nil, err
	}
	if err := state.ValidateUntrackedBaseline(value.UntrackedBaseline.Value); err != nil {
		return nil, err
	}
	if err := ValidateArtifacts(snapshot, workspace, value.Artifacts, "design_completion"); err != nil {
		return nil, err
	}
	if err := requireHashValue("rule_coverage", value.RuleCoverage.SHA256, value.RuleCoverage.Value); err != nil {
		return nil, err
	}
	if !equalJSON(value.TargetState.Value.OwnershipScopes, value.OwnershipScopes.Value) {
		return nil, diagnostic.New("AIDD_RECEIPT_OWNERSHIP", "ownership_scopes", "design_completion", "receipt ownership scopes must equal target-state ownership scopes", value.TargetState.Value.OwnershipScopes, value.OwnershipScopes.Value)
	}
	if err := semantic.ValidateTargetState(&value.TargetState.Value, requirementIDs(value.TargetState.Value), "design_completion.target_state"); err != nil {
		return nil, err
	}
	resolvedCatalog, err := catalog.Load(snapshot, value.VerificationProfiles.Path)
	if err != nil {
		return nil, err
	}
	if resolvedCatalog.SHA256 != value.VerificationProfiles.SHA256 {
		return nil, diagnostic.New("AIDD_PROFILE_DRIFT", value.VerificationProfiles.Path, "design_completion", "verification profile catalog changed after Design completion", value.VerificationProfiles.SHA256, resolvedCatalog.SHA256)
	}
	selected, err := semantic.ValidateProfiles(&value.TargetState.Value, resolvedCatalog, "design_completion.target_state")
	if err != nil {
		return nil, err
	}
	if !equalJSON(selected, value.VerificationProfiles.Selected) {
		return nil, diagnostic.New("AIDD_PROFILE_SELECTION", "verification_profiles.selected", "design_completion", "receipt selected profiles do not match target verification cases", selected, value.VerificationProfiles.Selected)
	}
	return &Loaded{Value: value, Bytes: content, SHA256: actualSHA256, Catalog: resolvedCatalog}, nil
}

func AssertBuildHead(ctx context.Context, snapshot *repository.Snapshot, expected string) error {
	if !commitPattern.MatchString(expected) {
		return diagnostic.New("AIDD_BUILD_BASELINE", "build_baseline.head", "design_completion", "receipt Build baseline must be a full lowercase Git commit ID", "40 lowercase hexadecimal characters", expected)
	}
	actual, err := snapshot.Head(ctx)
	if err != nil {
		return err
	}
	if actual != expected {
		return diagnostic.New("AIDD_BUILD_HEAD_DRIFT", "build_baseline.head", "design_completion", "Git HEAD must match the Build baseline fixed by Design completion", expected, actual)
	}
	return nil
}

func equalJSON(left, right any) bool {
	leftBytes, leftErr := canonical.Marshal(left)
	rightBytes, rightErr := canonical.Marshal(right)
	return leftErr == nil && rightErr == nil && string(leftBytes) == string(rightBytes)
}

func requireHashValue(label, expected string, value any) error {
	actual, err := canonical.Hash(value)
	if err != nil {
		return err
	}
	if expected != actual {
		return diagnostic.New("AIDD_RECEIPT_VALUE_HASH", label+".sha256", "design_completion", "receipt structured value hash does not match", expected, actual)
	}
	return nil
}

func requirementIDs(target model.TargetState) []string {
	seen := map[string]struct{}{}
	result := []string{}
	for _, verificationCase := range target.VerificationCases {
		if _, exists := seen[verificationCase.RequirementID]; exists {
			continue
		}
		seen[verificationCase.RequirementID] = struct{}{}
		result = append(result, verificationCase.RequirementID)
	}
	sort.Slice(result, func(i, j int) bool {
		return requirementOrder(result[i]) < requirementOrder(result[j])
	})
	return result
}

func requirementOrder(value string) int {
	parts := strings.Split(value, "-")
	if len(parts) != 2 {
		return 1 << 30
	}
	prefix := map[string]int{"FR": 0, "NFR": 1, "AC": 2}[parts[0]]
	number, _ := strconv.Atoi(parts[1])
	return prefix*1_000_000 + number
}

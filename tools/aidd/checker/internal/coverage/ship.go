package coverage

import (
	"bytes"
	"context"
	"regexp"
	"slices"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/evidence"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
)

var coverageDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func ValidateShip(ctx context.Context, snapshot *repository.Snapshot, loaded *receipt.Loaded, expectedCoverageSHA256 string) (*Record, error) {
	if err := receipt.AssertBuildHead(ctx, snapshot, loaded.Value.BuildBaseline.Head); err != nil {
		return nil, err
	}
	record, err := loadRecord(snapshot, loaded, expectedCoverageSHA256)
	if err != nil {
		return nil, err
	}
	if err := validateShipState(ctx, snapshot, loaded, record); err != nil {
		return nil, err
	}
	return record, nil
}

func loadRecord(snapshot *repository.Snapshot, loaded *receipt.Loaded, expectedSHA256 string) (*Record, error) {
	if !coverageDigestPattern.MatchString(expectedSHA256) {
		return nil, diagnostic.New("AIDD_SHIP_COVERAGE_HASH", "expected_coverage_sha256", "ship_candidate", "expected Build coverage hash must be a lowercase SHA-256 digest", "64 lowercase hexadecimal characters", expectedSHA256)
	}
	path, err := Path(loaded.Value.Workspace)
	if err != nil {
		return nil, err
	}
	content, err := snapshot.Read(path)
	if err != nil {
		return nil, err
	}
	actualSHA256 := canonical.HashBytes(content)
	if actualSHA256 != expectedSHA256 {
		return nil, diagnostic.New("AIDD_SHIP_COVERAGE_HASH", path, "ship_candidate", "Build coverage bytes do not match Build completion evidence", expectedSHA256, actualSHA256)
	}
	var record Record
	if err := canonical.Decode(content, "build_rule_coverage", &record); err != nil {
		return nil, err
	}
	canonicalContent, err := canonical.Pretty(record)
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(canonicalContent, content) {
		return nil, diagnostic.New("AIDD_SHIP_COVERAGE_CANONICAL", path, "ship_candidate", "Build coverage must use canonical JSON serialization", string(canonicalContent), string(content))
	}
	if record.SchemaVersion != model.CurrentSchemaVersion || record.Kind != "build_rule_coverage" || record.Workspace != loaded.Value.Workspace || record.ReceiptSHA256 != loaded.SHA256 {
		return nil, diagnostic.New("AIDD_SHIP_COVERAGE_IDENTITY", path, "ship_candidate", "Build coverage identity does not match the Design receipt", map[string]any{"schema_version": model.CurrentSchemaVersion, "kind": "build_rule_coverage", "workspace": loaded.Value.Workspace, "receipt_sha256": loaded.SHA256}, record)
	}
	return &record, nil
}

func validateShipState(ctx context.Context, snapshot *repository.Snapshot, loaded *receipt.Loaded, record *Record) error {
	loadedRules, err := rules.Load(snapshot, loaded.Value.RuleMap.Path)
	if err != nil {
		return err
	}
	if err := validatePinnedInputs(snapshot, loaded, loadedRules); err != nil {
		return err
	}
	_, evidenceBytes, err := evidence.LoadAndValidate(snapshot, loaded)
	if err != nil {
		return err
	}
	verificationPath, coveragePath, receiptPath, err := generatedArtifactPaths(loaded.Value.Workspace)
	if err != nil {
		return err
	}
	expectedEvidence := model.PathHash{Path: verificationPath, SHA256: canonical.HashBytes(evidenceBytes)}
	if record.VerificationEvidence != expectedEvidence {
		return diagnostic.New("AIDD_SHIP_EVIDENCE", verificationPath, "ship_candidate", "Build coverage does not reference the current canonical verification evidence", expectedEvidence, record.VerificationEvidence)
	}
	targetHash, err := canonical.Hash(loaded.Value.TargetState.Value)
	if err != nil {
		return err
	}
	finalHash, err := state.FinalHash(snapshot, &loaded.Value.TargetState.Value)
	if err != nil {
		return err
	}
	finalInventory, err := state.ValidateFinal(snapshot, &loaded.Value.TargetState.Value)
	if err != nil {
		return err
	}
	if record.TargetStateSHA256 != targetHash || record.FinalStateSHA256 != finalHash || !slices.Equal(record.BaselineInventory, loaded.Value.BaselineInventory.Value) || !slices.Equal(record.FinalInventory, finalInventory) {
		return diagnostic.New("AIDD_SHIP_FINAL_STATE", coveragePath, "ship_candidate", "Ship candidate no longer matches validated Build coverage", map[string]any{"target_state_sha256": targetHash, "final_state_sha256": finalHash, "baseline_inventory": loaded.Value.BaselineInventory.Value, "final_inventory": finalInventory}, record)
	}

	allowedGenerated := map[string]struct{}{receiptPath: {}, verificationPath: {}, coveragePath: {}}
	for _, pair := range []model.ArtifactPair{loaded.Value.Artifacts.Requirements, loaded.Value.Artifacts.Design} {
		allowedGenerated[pair.Source.Path] = struct{}{}
		allowedGenerated[pair.Display.Path] = struct{}{}
	}
	return validateStagedCandidate(ctx, snapshot, loaded.Value.BuildBaseline.Head, record.ChangedPaths, loaded.Value.UntrackedBaseline.Value, allowedGenerated)
}

func validateStagedCandidate(ctx context.Context, snapshot *repository.Snapshot, baseline string, covered []PathRecord, untrackedBaseline []model.UntrackedEntry, allowedGenerated map[string]struct{}) error {
	unstagedOutput, err := snapshot.Git(ctx,
		"-c", "core.fileMode=true",
		"diff", "--no-ext-diff", "--name-status", "-z", "--no-renames", "--ignore-submodules=none", "--",
	)
	if err != nil {
		return err
	}
	if len(unstagedOutput) != 0 {
		return diagnostic.New("AIDD_SHIP_WORKTREE_DRIFT", "worktree", "ship_candidate", "staged Ship content and mode must match the validated worktree", "no index-to-worktree diff", "unstaged tracked diff present")
	}
	stagedOutput, err := snapshot.Git(ctx,
		"-c", "core.fileMode=true",
		"diff", "--cached", "--no-ext-diff", "--name-status", "-z", "--no-renames", "--ignore-submodules=none", baseline, "--",
	)
	if err != nil {
		return err
	}
	stagedChanges, err := parseNameStatus(stagedOutput)
	if err != nil {
		return err
	}
	stagedByPath, err := uniqueChanges(stagedChanges, "AIDD_SHIP_STAGED_DUPLICATE")
	if err != nil {
		return err
	}
	coverageChanges := make([]change, len(covered))
	for index, item := range covered {
		coverageChanges[index] = change{Path: item.Path, Status: item.Status}
	}
	coverageByPath, err := uniqueChanges(coverageChanges, "AIDD_SHIP_COVERAGE_DUPLICATE")
	if err != nil {
		return err
	}
	baselineUntracked := make(map[string]model.UntrackedEntry, len(untrackedBaseline))
	for _, item := range untrackedBaseline {
		baselineUntracked[item.Path] = item
	}
	for _, expected := range covered {
		actual, exists := stagedByPath[expected.Path]
		if !exists {
			return diagnostic.New("AIDD_SHIP_PATH_MISSING", expected.Path, "ship_candidate", "validated Build path is absent from the staged Ship candidate", expected.Status, nil)
		}
		if expected.Status != actual.Status {
			_, wasUntracked := baselineUntracked[expected.Path]
			if !(wasUntracked && expected.Status == "M" && actual.Status == "A") {
				return diagnostic.New("AIDD_SHIP_PATH_STATUS", expected.Path, "ship_candidate", "staged Ship path status differs from Build coverage", expected.Status, actual.Status)
			}
		}
	}
	for _, staged := range stagedChanges {
		if _, covered := coverageByPath[staged.Path]; covered {
			continue
		}
		if _, generated := allowedGenerated[staged.Path]; !generated {
			return diagnostic.New("AIDD_SHIP_PATH_EXTRA", staged.Path, "ship_candidate", "staged Ship candidate contains a path outside validated Build coverage and canonical AIDD outputs", "validated Build path or canonical AIDD output", staged.Path)
		}
	}
	currentUntracked, err := state.UntrackedInventory(ctx, snapshot, nil)
	if err != nil {
		return err
	}
	currentByPath := make(map[string]model.UntrackedEntry, len(currentUntracked))
	for _, item := range currentUntracked {
		currentByPath[item.Path] = item
		if _, generated := allowedGenerated[item.Path]; generated {
			return diagnostic.New("AIDD_SHIP_UNSTAGED_PATH", item.Path, "ship_candidate", "canonical AIDD output must be staged before Ship", "staged canonical output", item)
		}
		expected, existed := baselineUntracked[item.Path]
		if !existed || expected != item {
			return diagnostic.New("AIDD_SHIP_UNSTAGED_PATH", item.Path, "ship_candidate", "new or changed non-ignored path must be staged before Ship", "unchanged Design baseline path", item)
		}
	}
	for _, baselineEntry := range untrackedBaseline {
		if _, stillUntracked := currentByPath[baselineEntry.Path]; stillUntracked {
			continue
		}
		if _, staged := stagedByPath[baselineEntry.Path]; staged {
			continue
		}
		return diagnostic.New("AIDD_SHIP_UNTRACKED_BASELINE", baselineEntry.Path, "ship_candidate", "a changed Design-baseline untracked path has no staged Ship representation", "unchanged untracked path or staged representation", nil)
	}
	return nil
}

func uniqueChanges(changes []change, code string) (map[string]change, error) {
	result := make(map[string]change, len(changes))
	for _, item := range changes {
		if previous, exists := result[item.Path]; exists {
			return nil, diagnostic.New(code, item.Path, "ship_candidate", "Ship path identities must be unique", previous.Status, item.Status)
		}
		result[item.Path] = item
	}
	return result, nil
}

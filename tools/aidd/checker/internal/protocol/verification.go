package protocol

import (
	"context"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/evidence"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
	"github.com/kosnu/savings/tools/aidd/checker/internal/state"
	"github.com/kosnu/savings/tools/aidd/checker/internal/verificationcontract"
)

func (l *Loaded) executionInput() verificationcontract.Input {
	return verificationcontract.Input{SchemaVersion: Version, Generator: Generator, Workspace: l.Task.Spec.ID, CheckpointSHA256: l.CheckpointHash, BaselineHead: l.Task.BaselineHead, Target: l.Checkpoint.Decision.Target, Catalog: l.Catalog}
}

func (l *Loaded) validateResult(ctx context.Context, snapshot *repository.Snapshot) ([]File, []string, error) {
	if err := CheckConfiguration(ctx, snapshot); err != nil {
		return nil, nil, err
	}
	if _, err := state.ValidateFinal(snapshot, &l.Checkpoint.Decision.Target); err != nil {
		return nil, nil, err
	}
	files, err := inventory(ctx, snapshot)
	if err != nil {
		return nil, nil, err
	}
	if err = l.checkGuards(ctx, snapshot, files); err != nil {
		return nil, nil, err
	}
	if err = l.validateGenerated(snapshot, files); err != nil {
		return nil, nil, err
	}
	if err = l.requireStorybook(ctx, snapshot, files); err != nil {
		return nil, nil, err
	}
	result := transportFiles(withoutGenerated(files, l.Task.Spec.ID), l.Delivered)
	paths := changed(transportFiles(l.Task.Baseline, l.Delivered), result)
	selected := map[string]bool{}
	for _, id := range l.Checkpoint.Rules {
		selected[id] = true
	}
	for _, p := range paths {
		if !owned(p, l.Checkpoint.Decision.Target.OwnershipScopes) {
			return nil, nil, fail("OWNERSHIP", p, "実差分がownership外です")
		}
		_, required, err := rules.ResolvePath(l.Rules, p)
		if err != nil {
			return nil, nil, err
		}
		for _, id := range required {
			if !selected[id] {
				return nil, nil, fail("RULE_COVERAGE", p, "実差分に必要なruleがcheckpointにありません: "+id)
			}
		}
	}
	return result, paths, nil
}

func (l *Loaded) validateGenerated(snapshot *repository.Snapshot, files []File) error {
	prefix := taskPath(l.Task.Spec.ID, "")
	allowed := map[string]bool{taskPath(l.Task.Spec.ID, "task.json"): true}
	checkpoints := map[string]bool{}
	for i := 1; i <= l.Checkpoint.Revision; i++ {
		allowed[checkpointPath(l.Task.Spec.ID, i)] = true
		_, digest, err := readMode[Checkpoint](snapshot, checkpointPath(l.Task.Spec.ID, i), l.Delivered)
		if err != nil {
			return err
		}
		checkpoints[digest] = true
	}
	for _, f := range files {
		if !strings.HasPrefix(f.Path, prefix) || allowed[f.Path] {
			continue
		}
		if strings.HasPrefix(f.Path, prefix+"evidence/") && strings.HasSuffix(f.Path, ".json") {
			e, _, err := readMode[Evidence](snapshot, f.Path, l.Delivered)
			if err != nil {
				return err
			}
			if e.SchemaVersion == Version && e.Kind == "verification_evidence" && e.TaskSHA256 == l.TaskHash && checkpoints[e.CheckpointSHA256] && f.Path == evidencePath(l.Task.Spec.ID, e.CheckpointSHA256) {
				continue
			}
		}
		if f.Path == taskPath(l.Task.Spec.ID, "learn-review.json") {
			r, _, err := readMode[Review](snapshot, f.Path, l.Delivered)
			if err != nil {
				return err
			}
			if l.Task.Spec.Kind == "learn" && r.SchemaVersion == Version && r.Kind == "learn_review" && r.TaskSHA256 == l.TaskHash && checkpoints[r.CheckpointSHA256] {
				continue
			}
		}
		return fail("OUTPUT", f.Path, "未宣言のchecker出力です")
	}
	return nil
}

func Verify(ctx context.Context, snapshot *repository.Snapshot, l *Loaded, options runner.Options) (string, error) {
	head, err := l.executionHead(ctx, snapshot, true)
	if err != nil {
		return "", err
	}
	files, paths, err := l.validateResult(ctx, snapshot)
	if err != nil {
		return "", err
	}
	result, err := runner.ExecuteContract(ctx, snapshot, func() verificationcontract.Input {
		input := l.executionInput()
		input.BaselineHead = head
		return input
	}(), options)
	if err != nil {
		return "", err
	}
	content, err := canonical.Pretty(result)
	if err != nil {
		return "", err
	}
	after, _, err := l.validateResult(ctx, snapshot)
	if err != nil {
		return "", err
	}
	if hash(files) != hash(after) {
		return "", fail("VERIFICATION_MUTATION", l.Task.Spec.ID, "検証対象が実行中に変わりました")
	}
	e := Evidence{Version, "verification_evidence", l.TaskHash, l.CheckpointHash, hash(files), files, paths, content, l.Task.CheckerSHA256}
	return write(snapshot, evidencePath(l.Task.Spec.ID, l.CheckpointHash), e, false)
}

func ValidateEvidence(ctx context.Context, snapshot *repository.Snapshot, l *Loaded, expected string) (*Evidence, error) {
	e, h, err := readMode[Evidence](snapshot, evidencePath(l.Task.Spec.ID, l.CheckpointHash), l.Delivered)
	if err != nil {
		return nil, err
	}
	if !digestPattern.MatchString(expected) || h != expected || e.SchemaVersion != Version || e.Kind != "verification_evidence" || e.TaskSHA256 != l.TaskHash || e.CheckpointSHA256 != l.CheckpointHash || e.CheckerSHA256 != l.Task.CheckerSHA256 {
		return nil, fail("EVIDENCE_IDENTITY", l.Task.Spec.ID, "検証証拠が現在task/checkpointと一致しません")
	}
	files, paths, err := l.validateResult(ctx, snapshot)
	if err != nil {
		return nil, err
	}
	if hash(files) != hash(transportFiles(e.Files, l.Delivered)) || hash(e.Files) != e.RepositorySHA256 || !sameStrings(paths, e.ChangedPaths) {
		return nil, fail("STALE_EVIDENCE", l.Task.Spec.ID, "検証後に対象の内容・mode・inventoryが変わりました")
	}
	final, err := state.FinalHash(snapshot, &l.Checkpoint.Decision.Target)
	if err != nil {
		return nil, err
	}
	if _, err = evidence.ValidateContract(e.Verification, l.executionInput(), final); err != nil {
		return nil, err
	}
	return &e, snapshot.AssertUnchanged()
}

// RecordLearnReviewは依頼により独立して確認されたreviewを固定する。
// 自動テストの成功からreview内容や変更許可を推測しない。
func RecordLearnReview(ctx context.Context, snapshot *repository.Snapshot, l *Loaded, evidenceHash string, r Review) (string, error) {
	if l.Task.Spec.Kind != "learn" {
		return "", fail("LEARN_REVIEW", l.Task.Spec.ID, "Learn以外には適用できません")
	}
	if _, err := ValidateEvidence(ctx, snapshot, l, evidenceHash); err != nil {
		return "", err
	}
	if err := validateReview(l, evidenceHash, r); err != nil {
		return "", err
	}
	return write(snapshot, taskPath(l.Task.Spec.ID, "learn-review.json"), r, false)
}

func validateReview(l *Loaded, evidenceHash string, r Review) error {
	if r.SchemaVersion != Version || r.Kind != "learn_review" || r.TaskSHA256 != l.TaskHash || r.CheckpointSHA256 != l.CheckpointHash || r.EvidenceSHA256 != evidenceHash || strings.TrimSpace(r.Reviewer) == "" || strings.TrimSpace(r.Authorization) == "" || strings.TrimSpace(r.Observations) == "" {
		return fail("LEARN_REVIEW", l.Task.Spec.ID, "現在の変更・証拠に対する独立reviewと確定許可が必要です")
	}
	return nil
}

func Ship(ctx context.Context, snapshot *repository.Snapshot, l *Loaded, evidenceHash string) error {
	if l.Task.Spec.Delivery != "pr" {
		return fail("DELIVERY_SCOPE", l.Task.Spec.ID, "Shipにはdelivery=prのTaskが必要です")
	}
	if _, err := ValidateEvidence(ctx, snapshot, l, evidenceHash); err != nil {
		return err
	}
	if l.Task.Spec.Kind == "learn" {
		review, _, err := read[Review](snapshot, taskPath(l.Task.Spec.ID, "learn-review.json"))
		if err != nil {
			return err
		}
		if err = validateReview(l, evidenceHash, review); err != nil {
			return err
		}
	}
	output, err := snapshot.Git(ctx, "-c", "core.fileMode=true", "diff", "--no-ext-diff", "--name-status", "-z", "--no-renames", "--")
	if err != nil {
		return err
	}
	if len(output) != 0 {
		return fail("STAGED_DRIFT", "index", "staged content/modeが検証済みworktreeと一致しません")
	}
	untracked, err := snapshot.Git(ctx, "ls-files", "--others", "--exclude-standard", "-z")
	if err != nil {
		return err
	}
	if len(untracked) != 0 {
		return fail("UNSTAGED", "index", "未stageの成果物があります")
	}
	// index-to-worktree一致と全repository evidence照合の両方を要求する。
	return snapshot.AssertUnchanged()
}

// Finishはlocal完了にもLearnの独立reviewを要求する。
func Finish(ctx context.Context, snapshot *repository.Snapshot, l *Loaded, evidenceHash string) error {
	if l.Task.Spec.Delivery == "pr" {
		return Ship(ctx, snapshot, l, evidenceHash)
	}
	if _, err := ValidateEvidence(ctx, snapshot, l, evidenceHash); err != nil {
		return err
	}
	if l.Task.Spec.Kind == "learn" {
		review, _, err := read[Review](snapshot, taskPath(l.Task.Spec.ID, "learn-review.json"))
		if err != nil {
			return err
		}
		if err = validateReview(l, evidenceHash, review); err != nil {
			return err
		}
	}
	return snapshot.AssertUnchanged()
}

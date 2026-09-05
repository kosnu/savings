package protocol

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

// CheckDeliveryはcommit後のGit転送を検証する。CIはPR baseのcheckerを使用する。
// 初期版では1 PRを1 taskの検証境界とし、baseline以前の未被覆差分を拒否する。
func CheckDelivery(ctx context.Context, snapshot *repository.Snapshot, base, id string) error {
	if len(base) != 40 {
		return fail("DELIVERY_BASE", base, "PR merge-baseの完全commit IDが必要です")
	}
	if id == "" {
		paths, err := snapshot.Git(ctx, "diff", "--name-only", base, "HEAD", "--", TaskRoot)
		if err != nil {
			return err
		}
		ids := map[string]bool{}
		for _, p := range strings.Split(strings.TrimSpace(string(paths)), "\n") {
			parts := strings.Split(p, "/")
			if len(parts) >= 4 {
				ids[parts[2]] = true
			}
		}
		if len(ids) != 1 {
			return fail("DELIVERY_TASK", TaskRoot, "変更されたtaskを1件に特定できません。全PR差分のtask/evidenceが必要です")
		}
		for value := range ids {
			id = value
		}
	}
	dirty, err := snapshot.Git(ctx, "status", "--porcelain=v1", "--untracked-files=all")
	if err != nil {
		return err
	}
	if len(dirty) != 0 {
		return fail("DELIVERY_DIRTY", id, "CIはcleanなcandidate checkoutで実行してください")
	}
	task, taskHash, err := readMode[Task](snapshot, taskPath(id, "task.json"), true)
	if err != nil {
		return err
	}
	if task.Spec.Delivery != "pr" {
		return fail("DELIVERY_SCOPE", id, "PR検証にはdelivery=prのTaskが必要です")
	}
	if task.BaselineHead != base {
		return fail("DELIVERY_BASE", id, "task baselineがPR全体の基準点と一致しません。全delivery差分を検証するtaskが必要です")
	}
	l, err := loadTaskMode(snapshot, id, taskHash, true)
	if err != nil {
		return err
	}
	baseline, err := gitInventory(ctx, snapshot, base)
	if err != nil {
		return err
	}
	if hash(transportFiles(task.Baseline, true)) != hash(baseline) {
		return fail("BASELINE", id, "task baselineがGitに保存された基準状態と一致しません")
	}
	for path, content := range map[string][]byte{PolicyPath: task.Policy, "docs/harness/rule-map.json": task.RuleMap, "docs/ai-driven-development/contracts/verification-profiles.json": task.Catalog} {
		blob, err := snapshot.Git(ctx, "show", base+":"+path)
		if err != nil {
			return err
		}
		if canonical.HashBytes(blob) != canonical.HashBytes(content) {
			return fail("BASELINE", path, "開始時のpolicy/rule/profileと基準commitが一致しません")
		}
	}
	if err = loadCheckpoints(snapshot, l); err != nil {
		return err
	}
	if l.CheckpointHash == "" {
		return fail("CHECKPOINT", id, "checkpointがありません")
	}
	_, evidenceHash, err := readMode[Evidence](snapshot, evidencePath(id, l.CheckpointHash), true)
	if err != nil {
		return err
	}
	if _, err = ValidateEvidence(ctx, snapshot, l, evidenceHash); err != nil {
		return err
	}
	if task.Spec.Kind == "learn" {
		r, _, err := readMode[Review](snapshot, taskPath(id, "learn-review.json"), true)
		if err != nil {
			return err
		}
		if err = validateReview(l, evidenceHash, r); err != nil {
			return err
		}
	}
	return snapshot.AssertUnchanged()
}

func gitInventory(ctx context.Context, snapshot *repository.Snapshot, ref string) ([]File, error) {
	entries, err := snapshot.Git(ctx, "ls-tree", "-r", "-z", ref)
	if err != nil {
		return nil, err
	}
	result := []File{}
	for _, entry := range strings.Split(strings.TrimSuffix(string(entries), "\x00"), "\x00") {
		if entry == "" {
			continue
		}
		meta, path, ok := strings.Cut(entry, "\t")
		fields := strings.Fields(meta)
		if !ok || len(fields) != 3 || fields[1] != "blob" {
			return nil, fmt.Errorf("unsupported Git tree entry %q", entry)
		}
		content, err := snapshot.Git(ctx, "cat-file", "blob", fields[2])
		if err != nil {
			return nil, err
		}
		kind := "regular"
		if fields[0] == "120000" {
			kind = "symlink"
		}
		result = append(result, File{path, kind, fields[0], canonical.HashBytes(content)})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Path < result[j].Path })
	return result, nil
}

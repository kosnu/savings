package protocol

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

// CheckDeliveryはcommit後のGit転送を検証する。CIはPR baseのcheckerを使用する。
// 各Taskの証拠を確認し、その和集合でPRの実差分を覆う。
func CheckDelivery(ctx context.Context, snapshot *repository.Snapshot, base, id string, targetBase ...string) error {
	return checkDelivery(ctx, snapshot, base, id, targetBase...)
}

// CheckMigrationDeliveryは移行申請の候補検証専用。base側の差分検査と人の承認を別途必要とする。
func CheckMigrationDelivery(ctx context.Context, snapshot *repository.Snapshot, base, id, targetBase string) error {
	return checkDelivery(ctx, snapshot, base, id, targetBase)
}

func checkDelivery(ctx context.Context, snapshot *repository.Snapshot, base, id string, targetBase ...string) error {
	if !commitPattern.MatchString(base) {
		return fail("DELIVERY_BASE", base, "PR merge-baseの完全commit IDが必要です")
	}
	dirty, err := snapshot.Git(ctx, "status", "--porcelain=v1", "--untracked-files=all")
	if err != nil {
		return err
	}
	if len(dirty) != 0 {
		return fail("DELIVERY_DIRTY", id, "CIはcleanなcandidate checkoutで実行してください")
	}
	before, err := gitInventory(ctx, snapshot, base)
	if err != nil {
		return err
	}
	after, err := gitInventory(ctx, snapshot, "HEAD")
	if err != nil {
		return err
	}
	paths := changed(before, after)
	ids, err := changedTaskIDs(paths)
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		return fail("DELIVERY_TASK", TaskRoot, "差分を検証したTaskがありません")
	}
	if id != "" && !slices.Contains(ids, id) {
		return fail("DELIVERY_TASK", id, "指定TaskがPRの変更記録にありません")
	}
	covered := map[string]bool{}
	baseFiles := fileMap(before)
	for _, taskID := range ids {
		l, err := checkTaskDelivery(ctx, snapshot, base, taskID, targetBase...)
		if err != nil {
			return err
		}
		origin := fileMap(transportFiles(l.changeBaseline(), true))
		for _, path := range l.changedPaths(after) {
			// 開始前の未検証変更を隠さず、PR基準点からの差分を証拠で覆う。
			if origin[path] == baseFiles[path] {
				covered[path] = true
			}
		}
	}
	for _, path := range paths {
		if strings.HasPrefix(path, TaskRoot+"/") {
			continue
		}
		if !covered[path] {
			return fail("DELIVERY_COVERAGE", path, "PR差分に対応するTaskの検証証拠がありません")
		}
	}
	return snapshot.AssertUnchanged()
}

func checkTaskDelivery(ctx context.Context, snapshot *repository.Snapshot, base, id string, targetBase ...string) (*Loaded, error) {
	task, taskHash, err := readMode[Task](snapshot, taskPath(id, "task.json"), true)
	if err != nil {
		return nil, err
	}
	l, err := loadTaskMode(snapshot, id, taskHash, true)
	if err != nil {
		return nil, err
	}
	baseline, err := gitInventory(ctx, snapshot, task.BaselineHead)
	if err != nil {
		return nil, err
	}
	if hash(transportFiles(task.Baseline, true)) != hash(baseline) {
		return nil, fail("BASELINE", id, "task baselineがGitに保存された基準状態と一致しません")
	}
	for path, content := range map[string][]byte{PolicyPath: task.Policy, "docs/harness/rule-map.json": task.RuleMap, "docs/ai-driven-development/contracts/verification-profiles.json": task.Catalog} {
		blob, err := snapshot.Git(ctx, "show", task.BaselineHead+":"+path)
		if err != nil {
			return nil, err
		}
		if canonical.HashBytes(blob) != canonical.HashBytes(content) {
			return nil, fail("BASELINE", path, "開始時のpolicy/rule/profileと基準commitが一致しません")
		}
	}
	if err = loadCheckpoints(snapshot, l); err != nil {
		return nil, err
	}
	if l.CheckpointHash == "" {
		return nil, fail("CHECKPOINT", id, "checkpointがありません")
	}
	// 契約移行だけなら実行checkerの移行記録は不要。flagで証跡要件は緩和しない。
	// 下のValidateEvidenceが、記録なしなら開始時checker、記録ありなら移行先checkerと
	// 最新checkpoint・最終状態に証跡が結合していることを共通に検査する。
	if _, err := snapshot.Git(ctx, "merge-base", "--is-ancestor", base, l.changeBaseHead()); err != nil {
		return nil, fail("DELIVERY_BASE", id, "Taskの変更基準がPRの履歴に含まれていません")
	}
	if _, err := snapshot.Git(ctx, "merge-base", "--is-ancestor", l.changeBaseHead(), "HEAD"); err != nil {
		return nil, fail("DELIVERY_BASE", id, "Taskの変更基準が現在HEADに含まれていません")
	}
	if l.Integration != nil {
		if len(targetBase) != 1 || targetBase[0] != l.Integration.BaseHead {
			return nil, fail("INTEGRATION_BASE", id, "統合baseがCIの現在のtarget baseと一致しません")
		}
	}
	_, evidenceHash, err := readMode[Evidence](snapshot, evidencePath(id, l.CheckpointHash), true)
	if err != nil {
		return nil, err
	}
	if err = l.loadPeerScopes(ctx, snapshot); err != nil {
		return nil, err
	}
	if _, err = ValidateEvidence(ctx, snapshot, l, evidenceHash); err != nil {
		return nil, err
	}
	return l, nil
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

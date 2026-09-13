package protocol

import (
	"context"
	"regexp"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

var commitPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

// 統合基準はcheckpointの明示入力とし、履歴から推測しない。
// ローカルではGitの包含関係、CIでは追加でtrusted target baseとの一致を検査する。
func (l *Loaded) selectIntegration(ctx context.Context, s *repository.Snapshot, next *Integration) error {
	if next == nil {
		if l.Integration != nil {
			return fail("INTEGRATION_HISTORY", l.Task.Spec.ID, "統合記録を後続checkpointから除去できません")
		}
		return nil
	}
	if !commitPattern.MatchString(next.BaseHead) || !commitPattern.MatchString(next.Head) {
		return fail("INTEGRATION", l.Task.Spec.ID, "統合base/headの完全commit IDが必要です")
	}
	head, err := s.Head(ctx)
	if err != nil {
		return err
	}
	pairs := [][2]string{{l.Task.BaselineHead, next.BaseHead}, {next.BaseHead, next.Head}, {next.Head, head}}
	if l.Integration != nil {
		pairs = append(pairs, [2]string{l.Integration.BaseHead, next.BaseHead}, [2]string{l.Integration.Head, next.Head})
	}
	for _, pair := range pairs {
		if _, err := s.Git(ctx, "merge-base", "--is-ancestor", pair[0], pair[1]); err != nil {
			return fail("INTEGRATION_HISTORY", l.Task.Spec.ID, "Task開始点・統合base/head・現在HEADの包含関係が不正です")
		}
	}
	baseline, err := gitInventory(ctx, s, next.BaseHead)
	if err != nil {
		return err
	}
	l.Integration, l.IntegrationBaseline = next, baseline
	return nil
}

func (l *Loaded) changeBaseline() []File {
	if l.Integration != nil {
		return l.IntegrationBaseline
	}
	return l.Task.Baseline
}

func (l *Loaded) changeBaseHead() string {
	if l.Integration != nil {
		return l.Integration.BaseHead
	}
	return l.Task.BaselineHead
}

func (l *Loaded) gitComparison() bool {
	return l.Delivered || l.Integration != nil
}

func (l *Loaded) changedPaths(files []File) []string {
	return changed(
		transportFiles(withoutGenerated(l.changeBaseline(), l.Task.Spec.ID), l.gitComparison()),
		transportFiles(withoutGenerated(files, l.Task.Spec.ID), l.gitComparison()),
	)
}

// checker移行は既存Taskに追記する判断であり、開始記録の置換ではない。
// authorizationの意味は実行agent、人によるCI受入承認はbase側migration jobが担う。
func (l *Loaded) selectCheckerMigration(s *repository.Snapshot, next *CheckerMigration, parent string) error {
	if next == nil {
		if l.CheckerMigration != nil {
			return fail("MIGRATION_HISTORY", l.Task.Spec.ID, "checker移行記録を除去できません")
		}
		return nil
	}
	if l.CheckerMigration != nil && hash(next) == hash(l.CheckerMigration) {
		return nil
	}
	if l.Task.Spec.Kind != "learn" || parent == "" || next.FromCheckpointSHA256 != parent || next.FromCheckerSHA256 != l.executionChecker() || !digestPattern.MatchString(next.ToCheckerSHA256) || next.ToCheckerSHA256 == next.FromCheckerSHA256 || strings.TrimSpace(next.Authorization) == "" {
		return fail("MIGRATION_AUTHORITY", l.Task.Spec.ID, "Learnの現在checkpoint・移行元/移行先checker・明示許可が必要です")
	}
	old, digest, err := readMode[Evidence](s, evidencePath(l.Task.Spec.ID, parent), l.Delivered)
	if err != nil {
		return err
	}
	if next.FromEvidenceSHA256 != digest || old.TaskSHA256 != l.TaskHash || old.CheckpointSHA256 != parent || old.CheckerSHA256 != next.FromCheckerSHA256 {
		return fail("MIGRATION_EVIDENCE", l.Task.Spec.ID, "移行元の証拠identityが一致しません")
	}
	previous := ""
	for _, scope := range next.AuthorizedScopes {
		if _, err := pathcontract.ValidateRelativePath(scope.Path); err != nil {
			return err
		}
		if (scope.Kind != "file" && scope.Kind != "tree") || scope.Path <= previous || scope.Path == TaskRoot || strings.HasPrefix(scope.Path, TaskRoot+"/") || !l.guarded(scope.Path) {
			return fail("MIGRATION_SCOPE", scope.Path, "移行には有限で整列したguardrail scopeを明示してください")
		}
		previous = scope.Path
	}
	l.MigrationScopes = append(l.MigrationScopes, next.AuthorizedScopes...)
	l.CheckerMigration = next
	return nil
}

func (l *Loaded) executionChecker() string {
	if l.CheckerMigration != nil {
		return l.CheckerMigration.ToCheckerSHA256
	}
	return l.Task.CheckerSHA256
}

func (l *Loaded) authorizedScopes() []model.OwnershipScope {
	return append(append(append([]model.OwnershipScope{}, l.Task.Spec.AuthorizedScopes...), l.MigrationScopes...), l.RevisionScopes...)
}

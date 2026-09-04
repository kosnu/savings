package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/receipt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

// 実行中のHEAD固定と、task全体の固定baselineを分離する。
// commit後も全差分を元のbaselineから検査し、baselineを取り直さない。
func (l *Loaded) executionHead(ctx context.Context, s *repository.Snapshot, unstaged bool) (string, error) {
	head, err := s.Head(ctx)
	if err != nil {
		return "", err
	}
	if _, err = s.Git(ctx, "merge-base", "--is-ancestor", l.Task.BaselineHead, head); err != nil {
		return "", fail("HISTORY", l.Task.Spec.ID, "task baselineを含まない履歴へ移動しています")
	}
	if unstaged {
		if err = receipt.AssertBuildGitState(ctx, s, head); err != nil {
			return "", err
		}
	}
	return head, s.AssertGitHeadUnchanged(ctx)
}

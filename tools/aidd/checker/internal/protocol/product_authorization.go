package protocol

import (
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
)

func (l *Loaded) validateProductAuthorization(d Decision) error {
	a := d.ProductAuthorization
	if a == nil {
		return nil
	}
	if !validExecutionIntent(a.Intent) || strings.TrimSpace(a.Authorization) == "" || len(a.Scopes) == 0 {
		return fail("PRODUCT_AUTHORITY", l.Task.Spec.ID, "product実装にはIssueまたはユーザー発言の本文・出典・hash、実行許可と有限scopeが必要です")
	}
	previous := ""
	for _, s := range a.Scopes {
		if _, err := pathcontract.ValidateRelativePath(s.Path); err != nil {
			return err
		}
		if (s.Kind != "file" && s.Kind != "tree") || s.Path <= previous || s.Path == ".aidd" || strings.HasPrefix(s.Path, ".aidd/") {
			return fail("PRODUCT_AUTHORITY", s.Path, "path順の有限file/tree scopeが必要です")
		}
		if !l.withinUserLimits(s) {
			return fail("USER_SCOPE_LIMIT", s.Path, "実装許可はユーザーの明示制限を解除しません")
		}
		if s.Kind == "tree" {
			for _, forbidden := range l.RepositoryPolicy.ForbiddenTreeScopes {
				if s.Path == forbidden {
					return fail("PRODUCT_AUTHORITY", s.Path, "禁止されたtree scopeです")
				}
			}
		}
		previous = s.Path
	}
	return nil
}

func (l *Loaded) checkProductAuthorization(path string) error {
	// Developmentの開始時実行依頼は再承認を要求しない。Learnの出典だけでは許可しない。
	if l.Task.Spec.Kind == "development" && validExecutionIntent(l.Task.Spec.Intent) {
		return nil
	}
	a := l.Checkpoint.Decision.ProductAuthorization
	if a != nil && owned(path, a.Scopes) {
		return nil
	}
	return fail("PRODUCT_AUTHORITY", path, "scopeやIntentの追加だけではproduct実装を許可できません。同じTaskのDecisionへ出典と実行許可を記録してください")
}

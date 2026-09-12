package protocol

import (
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

func (l *Loaded) withinUserLimits(scope model.OwnershipScope) bool {
	if len(l.Task.Spec.UserScopeLimits) > 0 && !scopeCovered(scope, l.Task.Spec.UserScopeLimits) {
		return false
	}
	for _, limits := range l.RevisionLimits {
		if !scopeCovered(scope, limits) {
			return false
		}
	}
	return true
}

// 各改訂は一度だけ追記する。許可文の意味・レビュー担当の真正性はagentの責務。
func (l *Loaded) selectScopeRevision(next *ScopeRevision, parent string) error {
	if next == nil {
		return nil
	}
	if l.Task.Spec.Kind != "learn" || parent == "" || len(next.AddedScopes) == 0 || strings.TrimSpace(next.Reason) == "" || strings.TrimSpace(next.BoundaryReview) == "" || strings.TrimSpace(next.Reviewer) == "" {
		return fail("SCOPE_REVISION", l.Task.Spec.ID, "Learnの既存checkpoint・追加scope・理由・委任境界のレビュー・確認者が必要です")
	}
	for _, scopes := range [][]model.OwnershipScope{next.AddedScopes, next.UserScopeLimits} {
		previous := ""
		for i, scope := range scopes {
			if _, err := pathcontract.ValidateRelativePath(scope.Path); err != nil {
				return err
			}
			if (scope.Kind != "file" && scope.Kind != "tree") || scope.Path <= previous || scope.Path == ".aidd" || strings.HasPrefix(scope.Path, ".aidd/") {
				return fail("SCOPE_REVISION", scope.Path, "整列した有限のfile/tree scopeが必要です")
			}
			for _, prior := range scopes[:i] {
				if scopeCovered(scope, []model.OwnershipScope{prior}) {
					return fail("SCOPE_REVISION", scope.Path, "重複したscopeです")
				}
			}
			if scope.Kind == "tree" {
				for _, forbidden := range l.RepositoryPolicy.ForbiddenTreeScopes {
					if scope.Path == forbidden {
						return fail("SCOPE_REVISION", scope.Path, "禁止されたtree scopeです")
					}
				}
			}
			previous = scope.Path
		}
	}
	if len(next.UserScopeLimits) > 0 {
		// 過去の制限との積集合で評価し、後続の自己申告による解除を許さない。
		l.RevisionLimits = append(l.RevisionLimits, next.UserScopeLimits)
	}
	for _, scope := range next.AddedScopes {
		if !l.withinUserLimits(scope) {
			return fail("USER_SCOPE_LIMIT", scope.Path, "ユーザーの明示制限を超える追加です")
		}
		if scopeCovered(scope, l.authorizedScopes()) {
			return fail("SCOPE_REVISION", scope.Path, "登録済みのscopeは再追加できません")
		}
		if !l.guarded(scope.Path) || rules.MatchesPath(l.Policy.ProductPaths, scope.Path) {
			return fail("LEARN_SCOPE", scope.Path, "追加対象はguardrailに限定します")
		}
	}
	l.RevisionScopes = append(l.RevisionScopes, next.AddedScopes...)
	return nil
}

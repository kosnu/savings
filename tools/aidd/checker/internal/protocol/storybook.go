package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/adapters/storybook"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

// tagの除去・ファイル削除も、変更判定基準と現在の両方から検査する。
// 動的tag生成・依存componentへの波及はrule reviewが補う。
func (l *Loaded) requireConditionalVerification(ctx context.Context, s *repository.Snapshot, files []File) error {
	for _, route := range l.RepositoryPolicy.ConditionalVerification {
		for _, path := range l.changedPaths(files) {
			if !rules.MatchesPath(route.Paths, path) {
				continue
			}
			matched := false
			for _, baseline := range []bool{true, false} {
				inventory := files
				if baseline {
					inventory = l.changeBaseline()
				}
				if _, ok := fileMap(inventory)[path]; !ok {
					continue
				}
				var data []byte
				var err error
				if baseline {
					data, err = s.Git(ctx, "show", l.changeBaseHead()+":"+path)
				} else {
					data, err = s.Read(path)
				}
				if err != nil {
					return err
				}
				switch route.Detector {
				case "storybook_tag_text":
					matched = matched || storybook.ContainsTagText(data, route.Value)
				default:
					return fail("POLICY", path, "未対応の検証対象detectorです")
				}
			}
			if !matched {
				continue
			}
			for _, profile := range route.Profiles {
				found := false
				for _, c := range l.Checkpoint.Decision.Target.VerificationCases {
					if c.Type == "automated" && c.VerificationProfileID == profile && c.Selector != nil && c.Selector.Kind == "suite" {
						found = true
					}
				}
				if !found {
					return fail("VERIFICATION_COVERAGE", path, "policyが要求する検証が不足しています: "+profile)
				}
			}
		}
	}
	return nil
}

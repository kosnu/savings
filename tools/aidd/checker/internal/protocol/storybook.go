package protocol

import (
	"bytes"
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"strings"
)

// tagの除去・ファイル削除も、開始時と現在の両方から検査する。
// 動的tag生成・依存componentへの波及はrule reviewが補う。
func (l *Loaded) requireStorybook(ctx context.Context, s *repository.Snapshot, files []File) error {
	for _, path := range changed(transportFiles(l.Task.Baseline, l.Delivered), transportFiles(withoutGenerated(files, l.Task.Spec.ID), l.Delivered)) {
		if !strings.HasPrefix(path, "apps/web/src/") || !(strings.HasSuffix(path, ".stories.tsx") || strings.HasSuffix(path, ".stories.ts")) {
			continue
		}
		tagged := false
		if _, ok := fileMap(l.Task.Baseline)[path]; ok {
			data, err := s.Git(ctx, "show", l.Task.BaselineHead+":"+path)
			if err != nil {
				return err
			}
			tagged = bytes.Contains(data, []byte("browser-test"))
		}
		if _, ok := fileMap(files)[path]; ok {
			data, err := s.Read(path)
			if err != nil {
				return err
			}
			tagged = tagged || bytes.Contains(data, []byte("browser-test"))
		}
		if tagged {
			found := false
			for _, c := range l.Checkpoint.Decision.Target.VerificationCases {
				if c.Type == "automated" && c.VerificationProfileID == "web-storybook-suite" && c.Selector != nil && c.Selector.Kind == "suite" {
					found = true
				}
			}
			if !found {
				return fail("VERIFICATION_COVERAGE", path, "browser-test対象の変更にはweb-storybook-suiteが必要です")
			}
		}
	}
	return nil
}

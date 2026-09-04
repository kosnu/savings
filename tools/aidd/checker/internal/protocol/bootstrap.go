package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"slices"
	"strings"
)

const BootstrapPath = "docs/ai-driven-development/migrations/vnext-bootstrap.json"

var bootstrapRecords = []string{BootstrapPath, "docs/ai-driven-development/migrations/vnext-verification.json"}

type BootstrapReview struct {
	SchemaVersion  int    `json:"schema_version"`
	Kind           string `json:"kind"`
	BaselineHead   string `json:"baseline_head"`
	Manifest       []File `json:"manifest"`
	ManifestSHA256 string `json:"manifest_sha256"`
	Reviewer       string `json:"reviewer"`
	Observations   string `json:"observations"`
}

func bootstrapManifest(ctx context.Context, s *repository.Snapshot, base string) ([]File, error) {
	before, err := gitInventory(ctx, s, base)
	if err != nil {
		return nil, err
	}
	after, err := inventory(ctx, s)
	if err != nil {
		return nil, err
	}
	current := fileMap(transportFiles(after, true))
	result := []File{}
	for _, p := range changed(before, transportFiles(after, true)) {
		if slices.Contains(bootstrapRecords, p) {
			continue
		}
		if f, ok := current[p]; ok {
			result = append(result, f)
		} else {
			result = append(result, File{Path: p, Type: "deleted"})
		}
	}
	return result, nil
}

// 初回移行にも対象差分に結合した独立review記録を要求する。
// 記録は署名ではなく、reviewerの真正性はLearnと同じ運用境界で扱う。
func CheckBootstrap(ctx context.Context, s *repository.Snapshot, base string) error {
	if len(base) != 40 {
		return fail("BOOTSTRAP", base, "完全な基準commit IDが必要です")
	}
	if _, err := s.Git(ctx, "merge-base", "--is-ancestor", base, "HEAD"); err != nil {
		return err
	}
	if _, err := s.Git(ctx, "cat-file", "-e", base+":"+PolicyPath); err == nil {
		return fail("BOOTSTRAP", base, "既存v5の検査をbootstrapへ迂回できません")
	}
	content, err := s.Read(BootstrapPath)
	if err != nil {
		return err
	}
	var r BootstrapReview
	if err = canonical.Decode(content, "bootstrap_review", &r); err != nil {
		return err
	}
	if r.SchemaVersion != 1 || r.Kind != "aidd_bootstrap_review" || r.BaselineHead != base || strings.TrimSpace(r.Reviewer) == "" || strings.TrimSpace(r.Observations) == "" {
		return fail("BOOTSTRAP", BootstrapPath, "独立reviewと基準点が必要です")
	}
	manifest, err := bootstrapManifest(ctx, s, base)
	if err != nil {
		return err
	}
	if len(manifest) == 0 || hash(manifest) != r.ManifestSHA256 || hash(r.Manifest) != r.ManifestSHA256 {
		return fail("BOOTSTRAP_DRIFT", BootstrapPath, "review対象のcontent/mode/pathが現在差分と一致しません")
	}
	return s.AssertUnchanged()
}

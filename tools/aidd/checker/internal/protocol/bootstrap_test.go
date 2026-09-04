package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"os"
	"path/filepath"
	"testing"
)

func TestBootstrapRequiresIndependentReviewOfExactDiff(t *testing.T) {
	f := setup(t, "development")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	must(t, os.Remove(filepath.Join(f.root, PolicyPath)))
	f.git("add", ".")
	f.git("commit", "-qm", "pre-v5 baseline")
	base := f.git("rev-parse", "HEAD")
	f.put("guard/rule.md", "migration result\n")
	check := func() error {
		return f.snapshot(func(s *repository.Snapshot) error { return CheckBootstrap(context.Background(), s, base) })
	}
	rejected(t, check(), "")
	var manifest []File
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		manifest, err = bootstrapManifest(context.Background(), s, base)
		return
	}))
	review := BootstrapReview{1, "aidd_bootstrap_review", base, manifest, hash(manifest), "independent test fixture", "Reviewed exact changed invariants"}
	body, err := canonical.Pretty(review)
	must(t, err)
	f.put(BootstrapPath, string(body))
	must(t, check())
	f.put("guard/rule.md", "changed after review\n")
	rejected(t, check(), "BOOTSTRAP_DRIFT")
	f.put("guard/rule.md", "migration result\n")
	must(t, os.Chmod(filepath.Join(f.root, "guard/rule.md"), 0755))
	rejected(t, check(), "BOOTSTRAP_DRIFT")
}

func TestBootstrapCannotBypassExistingProtocol(t *testing.T) {
	f := setup(t, "development")
	base := f.git("rev-parse", "HEAD")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckBootstrap(context.Background(), s, base) }), "BOOTSTRAP")
}

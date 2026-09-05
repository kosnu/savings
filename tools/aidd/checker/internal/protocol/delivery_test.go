package protocol

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func TestCommittedDeliveryUsesGitContentAndMode(t *testing.T) {
	f := setup(t, "development")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "deliver")
	// Git checkoutは0600を保存しない。輸送時のみGit modeで検査する。
	must(t, filepath.Walk(filepath.Join(f.root, TaskRoot), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return os.Chmod(path, 0644)
		}
		return nil
	}))
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
	f.put("src/a.txt", "unverified later change\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }), "STALE_EVIDENCE")
}

func TestDeliveryCannotHideEarlierCommits(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	f.git("add", ".")
	f.git("commit", "-qm", "deliver")
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, f.git("rev-parse", "HEAD"), f.spec.ID)
	}), "DELIVERY_BASE")
}

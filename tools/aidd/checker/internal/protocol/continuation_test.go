package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"testing"
)

func TestSameTaskContinuesAfterCommitAndReviewRevision(t *testing.T) {
	f := setup(t, "development")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	f.put("src/a.txt", "first result\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "first delivery")
	must(t, f.check(false))
	f.decision.Reason = "Review requires a refined implementation in the same task"
	must(t, f.checkpoint())
	f.put("src/a.txt", "reviewed result\n")
	rejected(t, f.check(false), "")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "review correction")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }))
}

func TestCommittedOutOfScopeChangeCannotBeHidden(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	must(t, f.verify())
	f.put("src/unowned.txt", "unverified\n")
	f.git("add", ".")
	f.git("commit", "-qm", "unowned commit")
	rejected(t, f.check(false), "OWNERSHIP")
	rejected(t, f.verify(), "OWNERSHIP")
}

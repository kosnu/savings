package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"testing"
)

func TestLocalTaskCanFinishButCannotShipOrPassPRDelivery(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		t.Run(kind, func(t *testing.T) {
			f := setup(t, kind, "local")
			base := f.git("rev-parse", "HEAD")
			must(t, f.checkpoint())
			must(t, f.verify())
			finish := func() error {
				return f.snapshot(func(s *repository.Snapshot) error {
					l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
					if err != nil {
						return err
					}
					return Finish(context.Background(), s, l, f.evidenceHash)
				})
			}
			if kind == "learn" {
				rejected(t, finish(), "")
				must(t, f.snapshot(func(s *repository.Snapshot) error {
					l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
					if err != nil {
						return err
					}
					_, err = RecordLearnReview(context.Background(), s, l, f.evidenceHash, Review{Version, "learn_review", f.taskHash, f.cp, f.evidenceHash, "independent fixture reviewer", "authorized fixture guardrail update", "The local guardrail result preserves the invariant and excludes product changes"})
					return err
				}))
			}
			must(t, finish())
			rejected(t, f.check(true), "DELIVERY_SCOPE")
			f.git("add", ".")
			rejected(t, f.check(true), "DELIVERY_SCOPE")
			f.git("commit", "-qm", "local result published outside contract")
			rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, f.spec.ID) }), "DELIVERY_SCOPE")
		})
	}
}

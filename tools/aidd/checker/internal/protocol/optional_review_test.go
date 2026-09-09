package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func recordOptionalReview(t *testing.T, f *fixture) Review {
	t.Helper()
	r := Review{Version, "learn_review", f.taskHash, f.cp, f.evidenceHash, "fixture reviewer", "authorized guardrail update", "Reviewed the invariant"}
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		_, err = RecordLearnReview(context.Background(), s, l, f.evidenceHash, r)
		return err
	}))
	return r
}

func TestOptionalReviewRejectsInvalidContentAtCompletion(t *testing.T) {
	for name, mutate := range map[string]func(*Review){
		"evidence":      func(r *Review) { r.EvidenceSHA256 = strings.Repeat("0", 64) },
		"reviewer":      func(r *Review) { r.Reviewer = " " },
		"authorization": func(r *Review) { r.Authorization = "" },
		"observations":  func(r *Review) { r.Observations = "" },
	} {
		t.Run(name, func(t *testing.T) {
			for _, delivery := range []string{"", "local", "pr"} {
				t.Run(delivery, func(t *testing.T) {
					f := setupLegacyTask(t, "learn", delivery)
					base := f.git("rev-parse", "HEAD")
					must(t, f.checkpoint())
					must(t, f.verify())
					r := recordOptionalReview(t, f)
					mutate(&r)
					body, err := canonical.Pretty(r)
					must(t, err)
					f.put(taskPath(f.spec.ID, "learn-review.json"), string(body))
					f.git("add", ".")
					rejected(t, f.snapshot(func(s *repository.Snapshot) error {
						l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
						if err != nil {
							return err
						}
						return Finish(context.Background(), s, l, f.evidenceHash)
					}), "LEARN_REVIEW")
					rejected(t, f.check(true), "LEARN_REVIEW")
					f.git("commit", "-qm", "invalid optional review fixture")
					rejected(t, f.snapshot(func(s *repository.Snapshot) error {
						return CheckDelivery(context.Background(), s, base, f.spec.ID)
					}), "LEARN_REVIEW")
				})
			}
		})
	}
}

func TestOptionalReviewHistoryDoesNotRequireNewReview(t *testing.T) {
	f := setup(t, "learn")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	must(t, f.verify())
	recordOptionalReview(t, f)
	f.decision.Reason = "Clarify the same authorized invariant"
	must(t, f.checkpoint())
	f.put("guard/rule.md", "Clarified invariant\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "retain optional historical review")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		return CheckDelivery(context.Background(), s, base, f.spec.ID)
	}))
}

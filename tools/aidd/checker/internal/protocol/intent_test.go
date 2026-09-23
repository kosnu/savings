package protocol

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func messageIntent(body string) Intent {
	return Intent{Kind: "message", Reference: "user:conversation/message-2", Body: body, BodySHA256: canonical.HashBytes([]byte(body))}
}

func restartWithIntent(t *testing.T, f *fixture, intent Intent, authorization string) {
	t.Helper()
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	f.spec.Intent, f.spec.Authorization = intent, authorization
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
}

func TestMessageDevelopmentThroughDelivery(t *testing.T) {
	for _, version := range []int{Version, CompactVersion} {
		t.Run(string(rune('0'+version)), func(t *testing.T) {
			f := setupVersion(t, "development", version)
			base := f.git("rev-parse", "HEAD")
			restartWithIntent(t, f, messageIntent(f.spec.Intent.Body), "User requests implementation and delivery")
			must(t, f.checkpoint())
			f.put("src/a.txt", "requested result\n")
			must(t, f.verify())
			f.git("add", ".")
			must(t, f.check(true))
			f.git("commit", "-qm", "message development")
			must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
		})
	}
}

func TestMessageDevelopmentRequiresExecutionAuthority(t *testing.T) {
	f := setup(t, "development")
	f.spec.Intent = messageIntent(f.spec.Intent.Body)
	rejected(t, validateSpec(f.spec), "INTENT")
	f.spec.Authorization = "User requests execution"
	must(t, validateSpec(f.spec))
	f.spec.Action = "analyze"
	rejected(t, validateSpec(f.spec), "ENTRYPOINT")
}

func TestIntentRevisionPreservesTaskAndSurvivesNextUpdate(t *testing.T) {
	for _, version := range []int{Version, CompactVersion} {
		for _, kind := range []string{"development", "learn"} {
			t.Run(kind+string(rune('0'+version)), func(t *testing.T) {
				f := setupVersion(t, kind, version)
				base := f.git("rev-parse", "HEAD")
				must(t, f.checkpoint())
				must(t, f.verify())
				taskPath := filepath.Join(f.root, taskPath(f.spec.ID, "task.json"))
				before, err := os.ReadFile(taskPath)
				must(t, err)
				body := "Bot-created pull requests must complete without failure"
				update := DecisionUpdate{Reason: "User clarified the intended result", IntentRevision: &IntentRevision{Intent: messageIntent(body), Reason: "Missing acceptance condition"}, Requirements: Changes[Requirement]{Upsert: []Requirement{{ID: "FR-1", Text: body, Origin: "intent", Evidence: body, IntentRevision: 2}}}}
				must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
					f.cp, err = UpdateDecision(context.Background(), s, f.spec.ID, 1, update)
					return
				}))
				rejected(t, f.check(false), "")
				must(t, f.verify())
				must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
					f.cp, err = UpdateDecision(context.Background(), s, f.spec.ID, 2, DecisionUpdate{Reason: "Refine design under the same intent"})
					return
				}))
				must(t, f.snapshot(func(s *repository.Snapshot) error {
					l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
					if err != nil {
						return err
					}
					if l.Checkpoint.Decision.IntentRevision != nil || len(l.intentSources()) != 2 || l.intentSources()[2].Body != body {
						t.Fatal("Intent event lost or replayed")
					}
					page, err := Inspect(context.Background(), s, f.spec.ID, "intent_sources", 0, 4000)
					if err == nil && !strings.Contains(page.Content, body) {
						t.Fatal("source missing from status")
					}
					return err
				}))
				must(t, f.verify())
				after, err := os.ReadFile(taskPath)
				must(t, err)
				if string(before) != string(after) {
					t.Fatal("Task was rewritten")
				}
				f.git("add", ".")
				must(t, f.check(true))
				f.git("commit", "-qm", "intent revision")
				must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
			})
		}
	}
}

func TestIntentRevisionRejectsInvalidSourceOrReference(t *testing.T) {
	for _, variant := range []string{"reference", "body", "hash", "kind", "issue-url", "reason", "future", "negative", "wrong-span", "derived"} {
		t.Run(variant, func(t *testing.T) {
			f := setup(t, "development")
			must(t, f.checkpoint())
			f.decision.IntentRevision = &IntentRevision{Intent: messageIntent("clarified intent"), Reason: "User correction"}
			r := &f.decision.Requirements[0]
			r.Evidence = "clarified intent"
			r.IntentRevision = 2
			switch variant {
			case "reference":
				f.decision.IntentRevision.Intent.Reference = " "
			case "body":
				f.decision.IntentRevision.Intent.Body = " "
			case "hash":
				f.decision.IntentRevision.Intent.BodySHA256 = strings.Repeat("a", 64)
			case "kind":
				f.decision.IntentRevision.Intent.Kind = "implementation"
			case "issue-url":
				f.decision.IntentRevision.Intent.Kind = "issue"
			case "reason":
				f.decision.IntentRevision.Reason = " "
			case "future":
				r.IntentRevision = 3
			case "negative":
				r.IntentRevision = -1
			case "wrong-span":
				r.Evidence = "invented requirement"
			case "derived":
				r.Origin = "derived"
			}
			rejected(t, f.checkpoint(), "")
		})
	}
}

func TestLearnIntentSourceDoesNotGrantProductAuthority(t *testing.T) {
	for _, source := range []string{"issue", "message", "revision"} {
		t.Run(source, func(t *testing.T) {
			f := setup(t, "learn")
			if source != "revision" {
				intent := messageIntent(f.spec.Intent.Body)
				if source == "issue" {
					intent.Kind = "issue"
					intent.Reference = "https://github.com/example/repository/issues/2"
				}
				restartWithIntent(t, f, intent, f.spec.Authorization)
			}
			must(t, f.checkpoint())
			addScopeDecision(f, "src/a.txt")
			if source == "revision" {
				f.decision.IntentRevision = &IntentRevision{Intent: messageIntent("Include Bot PRs"), Reason: "User clarified intent"}
			}
			must(t, f.checkpoint())
			f.put("src/a.txt", "product edit\n")
			rejected(t, f.verify(), "PRODUCT_AUTHORITY")
		})
	}
}

func TestMessageProductAuthorizationOnExistingLearn(t *testing.T) {
	f := setup(t, "learn")
	base := f.git("rev-parse", "HEAD")
	must(t, f.checkpoint())
	addScopeDecision(f, "src/a.txt")
	f.decision.ProductAuthorization = productAuthorization("src/a.txt")
	f.decision.ProductAuthorization.Intent = messageIntent("Implement the clarified Bot behavior")
	must(t, f.checkpoint())
	f.put("src/a.txt", "authorized result\n")
	must(t, f.verify())
	f.git("add", ".")
	must(t, f.check(true))
	f.git("commit", "-qm", "authorized message implementation")
	must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
	f.decision.ProductAuthorization.Authorization = " "
	f.decision.ScopeRevision = nil
	rejected(t, f.checkpoint(), "PRODUCT_AUTHORITY")
}

func TestUpdatedIssueIntentPreservesEarlierSourceReferences(t *testing.T) {
	f := setupVersion(t, "development", CompactVersion)
	must(t, f.checkpoint())
	source := f.spec.Intent
	source.Body = "Clarified Issue acceptance condition"
	source.BodySHA256 = canonical.HashBytes([]byte(source.Body))
	f.decision.IntentRevision = &IntentRevision{Intent: source, Reason: "User corrected the Issue"}
	f.decision.Requirements[0] = Requirement{ID: "FR-1", Text: source.Body, Origin: "intent", Evidence: source.Body, IntentRevision: 2}
	must(t, f.checkpoint())
	f.decision.IntentRevision = nil
	f.decision.Requirements[0].Text = f.spec.Intent.Body
	f.decision.Requirements[0].Evidence = f.spec.Intent.Body
	f.decision.Requirements[0].IntentRevision = 0
	must(t, f.checkpoint())
	must(t, f.verify())
	// 出典のない通常の設計revisionを要求の根拠として使えない。
	f.decision.Requirements[0].IntentRevision = 3
	rejected(t, f.checkpoint(), "PROVENANCE")
}

package protocol

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/runner"
)

type fixture struct {
	t                                *testing.T
	root, taskHash, cp, evidenceHash string
	spec                             Spec
	decision                         Decision
}

func (f *fixture) git(args ...string) string {
	f.t.Helper()
	c := exec.Command("git", args...)
	c.Dir = f.root
	c.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null")
	out, err := c.CombinedOutput()
	if err != nil {
		f.t.Fatalf("git %v: %v %s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}
func (f *fixture) put(path, body string) {
	f.t.Helper()
	full := filepath.Join(f.root, path)
	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(body), 0644); err != nil {
		f.t.Fatal(err)
	}
}
func (f *fixture) snapshot(fn func(*repository.Snapshot) error) error {
	f.t.Helper()
	s, err := repository.Open(context.Background(), f.root)
	if err != nil {
		return err
	}
	defer s.Close()
	return fn(s)
}
func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func rejected(t *testing.T, err error, fragment string) {
	t.Helper()
	if err == nil || fragment != "" && !strings.Contains(err.Error(), fragment) {
		t.Fatalf("expected rejection %q, got %v", fragment, err)
	}
}

func setup(t *testing.T, kind string) *fixture {
	t.Helper()
	f := &fixture{t: t, root: t.TempDir()}
	f.git("init", "-q")
	f.git("config", "user.name", "AIDD Test")
	f.git("config", "user.email", "aidd@example.invalid")
	f.put("src/a.txt", "before\n")
	f.put("guard/rule.md", "Existing accepted invariant\n")
	f.put(PolicyPath, `{"schema_version":1,"kind":"aidd_protocol","guardrail_paths":["guard/**","docs/**"],"product_paths":["src/**"],"required_verification":[{"paths":["**"],"profiles":["git-diff-check"]}]}`)
	f.put("docs/harness/rule-map.json", `{"version":2,"review_routing":{"governed_paths":["src/**","guard/**"],"surfaces":[{"id":"all","paths":["src/**","guard/**"],"required_rules":["invariant"]}]},"rules":[{"id":"invariant","file":"guard/rule.md","applies_to":{"paths":["src/**","guard/**"]},"depends_on":["dependency"],"overrides":[],"priority":1},{"id":"dependency","file":"guard/rule.md","applies_to":{},"depends_on":[],"overrides":[],"priority":0}]}`)
	f.put("docs/ai-driven-development/contracts/verification-profiles.json", `{"schema_version":1,"profiles":[{"id":"git-diff-check","contract":"suite","runner":"command_suite","selector_kind":"suite","selector_root":"","working_directory":"","argv":["git","diff","--no-ext-diff","HEAD","--check","--"]}]}`)
	f.git("add", ".")
	f.git("commit", "-qm", "baseline")
	body := "Make the requested result observable"
	f.spec = Spec{Action: "execute", SchemaVersion: Version, Kind: kind, ID: "test-task", Intent: Intent{Kind: "issue", Reference: "https://github.com/example/repository/issues/1", Body: body, BodySHA256: canonical.HashBytes([]byte(body))}, Objective: body, Constraints: []string{"preserve invariants"}, Done: []string{"observable result"}, Verification: []string{"fixed profile"}, Delivery: "local"}
	path := "src/a.txt"
	if kind == "learn" {
		f.spec.Intent.Kind = "feedback"
		f.spec.Intent.Reference = "review:one"
		f.spec.Authorization = "User explicitly authorized guardrail change"
		f.spec.AuthorizedScopes = []model.OwnershipScope{{Path: "guard/rule.md", Kind: "file"}}
		path = "guard/rule.md"
	}
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision = Decision{SchemaVersion: Version, Kind: "decision", TaskSHA256: f.taskHash, Reason: "Repository evidence supports this scoped decision", Requirements: []Requirement{{ID: "FR-1", Text: body, Origin: "intent", Evidence: body}}, Target: model.TargetState{ProductBehaviors: []model.ProductBehavior{{ID: "PB-1", Type: "state_transition", Description: "The requested result is observable", RequirementID: "FR-1"}}, VerificationCases: []model.VerificationCase{{ID: "VC-1", Type: "automated", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationProfileID: "git-diff-check", Selector: &model.Selector{Kind: "suite"}}}, OwnershipScopes: []model.OwnershipScope{{Path: path, Kind: "file"}}, Representations: []model.Representation{{ID: "REP-1", Kind: "implementation", Path: path, Locator: model.Locator{Kind: "file"}, RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, VerificationCaseIDs: []string{"VC-1"}}}}, AdditionalRules: []string{}}
	return f
}

func (f *fixture) checkpoint() error {
	return f.snapshot(func(s *repository.Snapshot) (err error) {
		f.cp, err = CheckpointDecision(context.Background(), s, f.spec.ID, f.taskHash, f.cp, f.decision)
		return
	})
}
func (f *fixture) verify() error {
	return f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		f.evidenceHash, err = Verify(context.Background(), s, l, runner.Options{})
		return err
	})
}
func (f *fixture) check(ship bool) error {
	return f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		if ship {
			return Ship(context.Background(), s, l, f.evidenceHash)
		}
		_, err = ValidateEvidence(context.Background(), s, l, f.evidenceHash)
		return err
	})
}

func TestDevelopmentWithoutGoalOrHook(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	must(t, f.check(false))
	f.git("add", ".")
	must(t, f.check(true))
}

func TestRejectsEvidenceForUnknownCheckpoint(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	must(t, f.verify())
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		e, _, err := read[Evidence](s, evidencePath(f.spec.ID, f.cp))
		if err != nil {
			return err
		}
		e.CheckpointSHA256 = strings.Repeat("a", 64)
		_, err = write(s, evidencePath(f.spec.ID, e.CheckpointSHA256), e, true)
		return err
	}))
	rejected(t, f.check(false), "OUTPUT")
}

func TestConfigurationRejectsBrokenReferences(t *testing.T) {
	for _, variant := range []string{"profile", "rule-document", "pattern", "mandatory-suite"} {
		t.Run(variant, func(t *testing.T) {
			f := setup(t, "learn")
			switch variant {
			case "profile":
				f.put("docs/ai-driven-development/contracts/verification-profiles.json", `{"schema_version":1,"profiles":[]}`)
			case "rule-document":
				must(t, os.Remove(filepath.Join(f.root, "guard/rule.md")))
			case "pattern", "mandatory-suite":
				content, err := os.ReadFile(filepath.Join(f.root, PolicyPath))
				must(t, err)
				old, next := `"guard/**"`, `"guard/a**"`
				if variant == "mandatory-suite" {
					old, next = `"**"`, `"src/**"`
				}
				f.put(PolicyPath, strings.Replace(string(content), old, next, 1))
			}
			rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckConfiguration(context.Background(), s) }), "")
		})
	}
}

func TestBaselineAllowsUnownedSymlinksAndDetectsTheirDrift(t *testing.T) {
	f := setup(t, "development")
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	must(t, os.Symlink("a.txt", filepath.Join(f.root, "src/link")))
	f.git("add", ".")
	f.git("commit", "-qm", "existing symlink")
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
	must(t, f.checkpoint())
	must(t, f.verify())
	must(t, os.Remove(filepath.Join(f.root, "src/link")))
	must(t, os.Symlink("elsewhere", filepath.Join(f.root, "src/link")))
	rejected(t, f.check(false), "OWNERSHIP")
}

func TestRejectsChangesOutsideOwnership(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("src/extra.txt", "unexpected\n")
	rejected(t, f.verify(), "OWNERSHIP")
}

func TestRuleClosureCannotBeOmitted(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		cp, _, err := read[Checkpoint](s, checkpointPath(f.spec.ID, 1))
		if err != nil {
			return err
		}
		cp.Rules = []string{"invariant"}
		b, err := canonical.Pretty(cp)
		if err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(f.root, checkpointPath(f.spec.ID, 1)), b, 0600)
	}))
	rejected(t, f.verify(), "RULE_COVERAGE")
}

func TestGuardrailDriftCannotBeAbsorbedByRevision(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("guard/rule.md", "weakened invariant\n")
	rejected(t, f.checkpoint(), "GUARDRAIL_DRIFT")
}

func TestGuardrailCannotBeOwnedByDevelopment(t *testing.T) {
	f := setup(t, "development")
	f.decision.Target.OwnershipScopes[0].Path = "guard/rule.md"
	f.decision.Target.Representations[0].Path = "guard/rule.md"
	rejected(t, f.checkpoint(), "GUARDRAIL_SCOPE")
}

func TestDecisionRevisionInvalidatesEvidenceAndPreservesBaseline(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("src/a.txt", "after\n")
	must(t, f.verify())
	old := f.cp
	baseline, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	f.decision.Reason = "New repository evidence changes the decision"
	must(t, f.checkpoint())
	current, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
	must(t, err)
	if string(baseline) != string(current) {
		t.Fatal("baseline changed on revision")
	}
	oldEvidence, err := os.ReadFile(filepath.Join(f.root, evidencePath(f.spec.ID, old)))
	must(t, err)
	must(t, os.WriteFile(filepath.Join(f.root, evidencePath(f.spec.ID, f.cp)), oldEvidence, 0600))
	rejected(t, f.check(false), "EVIDENCE_IDENTITY")
	// 古いcheckpointを明示しても最新revisionを迂回できない。
	latest := f.cp
	f.cp = old
	rejected(t, f.check(false), "STALE_CHECKPOINT")
	f.cp = latest
	must(t, os.Remove(filepath.Join(f.root, evidencePath(f.spec.ID, f.cp))))
	must(t, f.verify())
	must(t, f.check(false))
}

func TestBaselineCannotBeRetaken(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	f.put("src/a.txt", "unverified\n")
	err := f.snapshot(func(s *repository.Snapshot) error { _, err := Start(context.Background(), s, f.spec); return err })
	rejected(t, err, "BASELINE")
	f.git("add", ".")
	f.git("commit", "-qm", "unverified checkpoint")
	// commitしても未検証差分は元baselineから検証し、古い証拠は使えない。
	rejected(t, f.check(false), "")
	must(t, f.verify())
	must(t, f.check(false))
}

func TestEvidenceRejectsContentAndModeDrift(t *testing.T) {
	for _, mode := range []bool{false, true} {
		t.Run(map[bool]string{false: "content", true: "mode"}[mode], func(t *testing.T) {
			f := setup(t, "development")
			must(t, f.checkpoint())
			f.put("src/a.txt", "after\n")
			must(t, f.verify())
			if mode {
				must(t, os.Chmod(filepath.Join(f.root, "src/a.txt"), 0755))
			} else {
				f.put("src/a.txt", "later\n")
			}
			rejected(t, f.check(false), "STALE_EVIDENCE")
		})
	}
}

func TestShipRejectsStagedMismatchAndExtraPath(t *testing.T) {
	for _, kind := range []string{"content", "mode", "extra"} {
		t.Run(kind, func(t *testing.T) {
			f := setup(t, "development")
			must(t, f.checkpoint())
			f.put("src/a.txt", "after\n")
			must(t, f.verify())
			f.git("add", ".")
			switch kind {
			case "content":
				f.put("src/a.txt", "changed\n")
				f.git("add", "src/a.txt")
				f.put("src/a.txt", "after\n")
			case "mode":
				f.git("update-index", "--chmod=+x", "src/a.txt")
			case "extra":
				f.put("src/extra.txt", "unexpected\n")
				f.git("add", "src/extra.txt")
			}
			rejected(t, f.check(true), "")
		})
	}
}

func TestTaskArtifactDrift(t *testing.T) {
	f := setup(t, "development")
	must(t, f.checkpoint())
	must(t, os.Chmod(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")), 0644))
	rejected(t, f.verify(), "")
}

func TestRequiredVerificationCannotBeManualOnly(t *testing.T) {
	f := setup(t, "development")
	f.decision.Target.VerificationCases[0] = model.VerificationCase{ID: "VC-1", Type: "manual", RequirementID: "FR-1", ProductBehaviorIDs: []string{"PB-1"}, Procedure: "Observe the requested outcome in the interface"}
	rejected(t, f.checkpoint(), "VERIFICATION_COVERAGE")
}

func TestLearnRejectsProductChanges(t *testing.T) {
	f := setup(t, "learn")
	must(t, f.checkpoint())
	f.put("src/a.txt", "unexpected product change\n")
	rejected(t, f.verify(), "LEARN_SCOPE")
}

func TestLearnNeedsBaselineCheckerAndIndependentReview(t *testing.T) {
	f := setup(t, "learn")
	must(t, f.checkpoint())
	f.put("guard/rule.md", "Clarified accepted invariant\n")
	must(t, f.verify())
	rejected(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		return Finish(context.Background(), s, l, f.evidenceHash)
	}), "")
	f.git("add", ".")
	rejected(t, f.check(true), "")
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := Load(context.Background(), s, f.spec.ID, f.taskHash, f.cp)
		if err != nil {
			return err
		}
		candidate := *l
		candidate.Task.CheckerSHA256 = strings.Repeat("0", 64)
		rejected(t, candidate.checkAuthority(), "CHECKER_IDENTITY")
		r := Review{Version, "learn_review", f.taskHash, f.cp, f.evidenceHash, "independent reviewer", "User approved this guardrail update", "Existing invariant remains enforced and the changed rule is justified"}
		_, err = RecordLearnReview(context.Background(), s, l, f.evidenceHash, r)
		return err
	}))
	f.git("add", ".")
	must(t, f.check(true))
}

func TestNewExecutionRejectsLegacyAndMissingIntent(t *testing.T) {
	f := setup(t, "development")
	spec := f.spec
	spec.SchemaVersion = 4
	rejected(t, validateSpec(spec), "PROTOCOL")
	spec = f.spec
	spec.Intent.Reference = ""
	rejected(t, validateSpec(spec), "INTENT")
}

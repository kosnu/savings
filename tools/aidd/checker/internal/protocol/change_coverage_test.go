package protocol

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repositorypolicy"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

func coverageModel(t *testing.T) *ChangeCoverageModel {
	t.Helper()
	b, err := os.ReadFile("../../../../../" + ChangeCoveragePath)
	must(t, err)
	m, err := parseChangeCoverage(b)
	must(t, err)
	return m
}

func coverageDecision(m *ChangeCoverageModel, path string) []ChangeCoverage {
	c := ChangeCoverage{ID: "continuation", Concept: "判断改訂後の継続", Representations: []CoverageRepresentation{{Path: path, Status: "affected", Reason: "対象操作を変更する"}}}
	for _, axis := range m.Axes {
		c.Patterns = append(c.Patterns, CoveragePattern{Axis: axis.ID, Scenario: axis.Question, Status: "affected", Reason: "継続と拒否条件を確認する", VerificationCaseIDs: []string{"VC-1"}})
	}
	return []ChangeCoverage{c}
}

func setupCoverage(t *testing.T, kind string, version int) *fixture {
	t.Helper()
	f := setupVersion(t, kind, version)
	m := coverageModel(t)
	m.Paths = []string{"guard/**", "src/**"}
	b, err := canonical.Pretty(m)
	must(t, err)
	f.put(ChangeCoveragePath, string(b))
	restartWithPolicy(t, f, repositorypolicy.Legacy())
	f.decision.ChangeCoverage = coverageDecision(m, f.decision.Target.Representations[0].Path)
	return f
}

func TestChangeCoverageRejectsMissingDecisionsAndReferences(t *testing.T) {
	f := setupCoverage(t, "learn", CompactVersion)
	variants := map[string]func(*Decision){
		"missing-concept":        func(d *Decision) { d.ChangeCoverage = nil },
		"missing-axis":           func(d *Decision) { d.ChangeCoverage[0].Patterns = d.ChangeCoverage[0].Patterns[1:] },
		"duplicate-concept":      func(d *Decision) { d.ChangeCoverage = append(d.ChangeCoverage, d.ChangeCoverage[0]) },
		"unknown-axis":           func(d *Decision) { d.ChangeCoverage[0].Patterns[0].Axis = "unknown" },
		"duplicate-axis":         func(d *Decision) { d.ChangeCoverage[0].Patterns[1].Axis = d.ChangeCoverage[0].Patterns[0].Axis },
		"missing-scenario":       func(d *Decision) { d.ChangeCoverage[0].Patterns[0].Scenario = " " },
		"missing-reason":         func(d *Decision) { d.ChangeCoverage[0].Patterns[0].Reason = " " },
		"invalid-status":         func(d *Decision) { d.ChangeCoverage[0].Patterns[0].Status = "done" },
		"missing-case":           func(d *Decision) { d.ChangeCoverage[0].Patterns[0].VerificationCaseIDs = nil },
		"unknown-case":           func(d *Decision) { d.ChangeCoverage[0].Patterns[0].VerificationCaseIDs = []string{"VC-99"} },
		"duplicate-case":         func(d *Decision) { d.ChangeCoverage[0].Patterns[0].VerificationCaseIDs = []string{"VC-1", "VC-1"} },
		"unowned-representation": func(d *Decision) { d.ChangeCoverage[0].Representations[0].Path = "guard/other.md" },
		"duplicate-representation": func(d *Decision) {
			c := &d.ChangeCoverage[0]
			c.Representations = append(c.Representations, c.Representations[0])
		},
		"missing-representation-reason": func(d *Decision) { d.ChangeCoverage[0].Representations[0].Reason = " " },
	}
	for name, mutate := range variants {
		t.Run(name, func(t *testing.T) {
			data, err := canonical.Pretty(f.decision)
			must(t, err)
			var d Decision
			must(t, canonical.Decode(data, "decision", &d))
			mutate(&d)
			rejected(t, f.snapshot(func(s *repository.Snapshot) error {
				_, err := CheckpointDecision(context.Background(), s, f.spec.ID, f.taskHash, "", d)
				return err
			}), "CHANGE_COVERAGE")
		})
	}
	// 不変・対象外は正式な判断。変更しない文書へownershipを要求しない。
	f.decision.ChangeCoverage[0].Representations = append(f.decision.ChangeCoverage[0].Representations, CoverageRepresentation{Path: "docs/adapter.md", Status: "unaffected", Reason: "adapterの呼出契約は維持する"})
	f.decision.ChangeCoverage[0].Patterns[0].Status = "unaffected"
	f.decision.ChangeCoverage[0].Patterns[0].VerificationCaseIDs = nil
	f.decision.ChangeCoverage[0].Patterns[1].Status = "not-applicable"
	f.decision.ChangeCoverage[0].Patterns[1].VerificationCaseIDs = nil
	must(t, f.checkpoint())
}

func TestChangeCoverageContinuesAndBindsEvidence(t *testing.T) {
	for _, version := range []int{Version, CompactVersion} {
		for _, kind := range []string{"development", "learn"} {
			f := setupCoverage(t, kind, version)
			must(t, f.checkpoint())
			original, err := os.ReadFile(filepath.Join(f.root, checkpointPath(f.spec.ID, 1)))
			must(t, err)
			f.put(f.decision.Target.Representations[0].Path, "after\n")
			must(t, f.verify())
			must(t, f.check(false))
			must(t, f.snapshot(func(s *repository.Snapshot) error {
				ctx := context.Background()
				_, err := UpdateDecision(ctx, s, f.spec.ID, 1, DecisionUpdate{Reason: "理由だけの更新でもCoverageを維持"})
				return err
			}))
			must(t, f.snapshot(func(s *repository.Snapshot) error {
				l, _, err := Resolve(context.Background(), s, f.spec.ID, 2)
				if err != nil {
					return err
				}
				f.cp = l.CheckpointHash
				if len(l.Checkpoint.Decision.ChangeCoverage) != 1 {
					t.Fatal("Coverageが失われた")
				}
				return nil
			}))
			rejected(t, f.check(false), "")
			must(t, f.verify())
			base := f.git("rev-parse", "HEAD")
			f.git("add", ".")
			must(t, f.check(true))
			f.git("commit", "-qm", "covered change")
			must(t, f.snapshot(func(s *repository.Snapshot) error { return CheckDelivery(context.Background(), s, base, "") }))
			after, err := os.ReadFile(filepath.Join(f.root, checkpointPath(f.spec.ID, 1)))
			must(t, err)
			if !bytes.Equal(original, after) {
				t.Fatal("過去checkpointが変更された")
			}
			rejected(t, f.snapshot(func(s *repository.Snapshot) error {
				_, err := UpdateDecision(context.Background(), s, f.spec.ID, 2, DecisionUpdate{Reason: "必要な概念を削除", ChangeCoverage: Changes[ChangeCoverage]{Remove: []string{"continuation"}}})
				return err
			}), "CHANGE_COVERAGE")
		}
	}
}

func TestChangeCoverageUsesPinnedModelAndActualChanges(t *testing.T) {
	f := setupCoverage(t, "learn", CompactVersion)
	f.decision.ChangeCoverage[0].Representations[0].Status = "unaffected"
	must(t, f.checkpoint())
	f.put("guard/rule.md", "actually changed\n")
	rejected(t, f.verify(), "CHANGE_COVERAGE")
	m := coverageModel(t)
	m.Axes = m.Axes[:1]
	b, err := canonical.Pretty(m)
	must(t, err)
	f.put(ChangeCoveragePath, string(b))
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		l, err := loadTask(s, f.spec.ID, f.taskHash)
		if err != nil {
			return err
		}
		if len(l.ChangeCoverageModel.Axes) != 5 {
			t.Fatal("候補モデルで開始時モデルが置換された")
		}
		return nil
	}))
	must(t, os.Remove(filepath.Join(f.root, ChangeCoveragePath)))
	rejected(t, f.snapshot(func(s *repository.Snapshot) error { return CheckConfiguration(context.Background(), s) }), "")
}

func TestChangeCoverageModelRejectsInvalidConfiguration(t *testing.T) {
	for _, source := range []string{
		`{"schema_version":1,"kind":"aidd_change_coverage","paths":[],"axes":[]}`,
		`{"schema_version":1,"kind":"aidd_change_coverage","paths":["a**b"],"axes":[{"id":"a","question":"q"}]}`,
		`{"schema_version":1,"kind":"aidd_change_coverage","paths":["**"],"axes":[{"id":"a","question":"q"},{"id":"a","question":"q"}]}`,
	} {
		_, err := parseChangeCoverage([]byte(source))
		rejected(t, err, "")
	}
	m := coverageModel(t)
	var axes []string
	for _, axis := range m.Axes {
		axes = append(axes, axis.ID)
	}
	if !slices.Equal(axes, []string{"sequence", "indirect-inputs", "execution-paths", "semantic-roles", "preserved-guarantees"}) {
		t.Fatal("5件由来の5軸が欠落")
	}
	for _, path := range []string{ChangeCoveragePath, PolicyPath, "docs/ai-driven-development/contracts/verification-profiles.json", "tools/aidd/checker/internal/protocol/agent_input.go", "AGENTS.md", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".github/workflows/aidd_checker_ci.yaml"} {
		if !rules.MatchesPath(m.Paths, path) {
			t.Errorf("必須検討対象が欠落: %s", path)
		}
	}
	for _, path := range []string{"apps/web/src/page.tsx", "apps/api/supabase/migrations/one.sql"} {
		if rules.MatchesPath(m.Paths, path) {
			t.Errorf("productだけの変更を対象にした: %s", path)
		}
	}
}

func TestChangeCoverageDeletionKeepsOwnershipAndFinalInventory(t *testing.T) {
	f := setupCoverage(t, "development", CompactVersion)
	f.put("src/obsolete.txt", "remove this representation\n")
	restartWithPolicy(t, f, repositorypolicy.Legacy())
	f.decision.Target.OwnershipScopes = []model.OwnershipScope{{Path: "src", Kind: "tree"}}
	f.decision.ChangeCoverage[0].Representations = append(f.decision.ChangeCoverage[0].Representations, CoverageRepresentation{Path: "src/obsolete.txt", Status: "affected", Reason: "責務をsrc/a.txtへ統合して削除する"})
	must(t, f.checkpoint())
	// 削除予定を記録しただけでは、残存fileを無視して成功しない。
	rejected(t, f.verify(), "FINAL_INVENTORY")
	must(t, os.Remove(filepath.Join(f.root, "src/obsolete.txt")))
	f.put("src/a.txt", "responsibility retained\n")
	must(t, f.verify())
	must(t, f.check(false))
}

func TestChangeCoverageRoutingStaysConnected(t *testing.T) {
	m := coverageModel(t)
	b, err := os.ReadFile("../../../../../docs/harness/rule-map.json")
	must(t, err)
	r, err := rules.Parse(b, "rule-map")
	must(t, err)
	node, ok := r.ByID["ai-driven.change-coverage"]
	if !ok || !slices.Equal(node.AppliesTo.Paths, m.Paths) {
		t.Fatal("モデルと正本文書のroutingが不一致")
	}
	b, err = os.ReadFile("../../../../../" + PolicyPath)
	must(t, err)
	p, err := parsePolicy(b)
	must(t, err)
	for _, route := range p.RequiredVerification {
		if rules.MatchesPath(route.Paths, ChangeCoveragePath) && slices.Contains(route.Profiles, "aidd-checker-tests") {
			return
		}
	}
	t.Fatal("モデル変更にchecker回帰suiteが要求されない")
}

func TestChangeCoverageLegacyTaskKeepsHistory(t *testing.T) {
	for _, version := range []int{Version, CompactVersion} {
		f := setupVersion(t, "learn", version)
		// 旧binaryの開始記録をfixtureで再現する。新規Startの必須条件は緩和しない。
		must(t, f.snapshot(func(s *repository.Snapshot) error {
			task, _, err := read[Task](s, taskPath(f.spec.ID, "task.json"))
			if err != nil {
				return err
			}
			must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
			must(t, os.Remove(filepath.Join(f.root, ChangeCoveragePath)))
			f.git("add", ".")
			f.git("commit", "-qm", "legacy without coverage")
			task.BaselineHead = f.git("rev-parse", "HEAD")
			var files []File
			for _, file := range task.Baseline {
				if file.Path != ChangeCoveragePath {
					files = append(files, file)
				}
			}
			task.Baseline = files
			data, err := canonical.Pretty(task)
			if err != nil {
				return err
			}
			path := filepath.Join(f.root, taskPath(f.spec.ID, "task.json"))
			must(t, os.MkdirAll(filepath.Dir(path), 0755))
			must(t, os.WriteFile(path, data, 0600))
			f.taskHash = canonical.HashBytes(data)
			f.decision.TaskSHA256 = f.taskHash
			return nil
		}))
		original, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
		must(t, err)
		must(t, f.checkpoint())
		f.put("guard/rule.md", "legacy continues\n")
		must(t, f.verify())
		must(t, f.check(false))
		// candidateにモデルを追加しても旧Taskには遡及しない。
		m := coverageModel(t)
		b, err := canonical.Pretty(m)
		must(t, err)
		f.put(ChangeCoveragePath, string(b))
		must(t, f.snapshot(func(s *repository.Snapshot) error {
			l, err := loadTask(s, f.spec.ID, f.taskHash)
			if err == nil && l.ChangeCoverageModel != nil {
				t.Fatal("旧Taskへモデルを遡及適用した")
			}
			return err
		}))
		after, err := os.ReadFile(filepath.Join(f.root, taskPath(f.spec.ID, "task.json")))
		must(t, err)
		if !bytes.Equal(original, after) {
			t.Fatal("旧Task記録が変わった")
		}
	}
}

func TestChangeCoverageUpdateAndInspect(t *testing.T) {
	f := setupCoverage(t, "learn", CompactVersion)
	must(t, f.checkpoint())
	c := f.decision.ChangeCoverage[0]
	c.Patterns[0].Status, c.Patterns[0].Reason = "unaffected", "操作順序の契約は維持する"
	must(t, f.snapshot(func(s *repository.Snapshot) error {
		_, err := UpdateDecision(context.Background(), s, f.spec.ID, 1, DecisionUpdate{Reason: "影響判定を改訂", ChangeCoverage: Changes[ChangeCoverage]{Upsert: []ChangeCoverage{c}}})
		return err
	}))
	for _, field := range []string{"change_coverage", "change_coverage_model"} {
		must(t, f.snapshot(func(s *repository.Snapshot) error {
			p, err := Inspect(context.Background(), s, f.spec.ID, field, 0, 4000)
			if err == nil && (p.Revision != 2 || p.Content == "null\n" || p.Content == "[]\n") {
				t.Fatal("最新判断または開始時モデルを取得できない")
			}
			return err
		}))
	}
}

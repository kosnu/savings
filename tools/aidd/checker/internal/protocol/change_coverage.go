package protocol

import (
	"context"
	"maps"
	"slices"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

const ChangeCoveragePath = "docs/ai-driven-development/contracts/change-coverage.json"

// モデルは開始時Git treeから復元し、変更後の自己申告で必須軸を減らさない。
type ChangeCoverageModel struct {
	SchemaVersion int            `json:"schema_version"`
	Kind          string         `json:"kind"`
	Paths         []string       `json:"paths"`
	Axes          []CoverageAxis `json:"axes"`
}

type CoverageAxis struct {
	ID       string `json:"id"`
	Question string `json:"question"`
}

type ChangeCoverage struct {
	ID              string                   `json:"id"`
	Concept         string                   `json:"concept"`
	Representations []CoverageRepresentation `json:"representations"`
	Patterns        []CoveragePattern        `json:"patterns"`
}

type CoverageRepresentation struct {
	Path   string `json:"path"`
	Status string `json:"status"`
	Reason string `json:"reason"`
}

type CoveragePattern struct {
	Axis                string   `json:"axis"`
	Scenario            string   `json:"scenario"`
	Status              string   `json:"status"`
	Reason              string   `json:"reason"`
	VerificationCaseIDs []string `json:"verification_case_ids,omitempty"`
}

func parseChangeCoverage(data []byte) (*ChangeCoverageModel, error) {
	var m ChangeCoverageModel
	if err := canonical.Decode(data, ChangeCoveragePath, &m); err != nil {
		return nil, err
	}
	if m.SchemaVersion != 1 || m.Kind != "aidd_change_coverage" || len(m.Paths) == 0 || len(m.Axes) == 0 {
		return nil, fail("CHANGE_COVERAGE", ChangeCoveragePath, "対象pathと必須軸を持つモデルが必要です")
	}
	if err := rules.ValidatePatterns(m.Paths, ChangeCoveragePath); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, axis := range m.Axes {
		if strings.TrimSpace(axis.ID) == "" || seen[axis.ID] || strings.TrimSpace(axis.Question) == "" {
			return nil, fail("CHANGE_COVERAGE", axis.ID, "一意の軸IDと検討する問いが必要です")
		}
		seen[axis.ID] = true
	}
	return &m, nil
}

func checkChangeCoverageConfiguration(s *repository.Snapshot, required bool) error {
	exists, err := s.Exists(ChangeCoveragePath)
	if err != nil {
		return err
	}
	if !exists && !required {
		return nil
	}
	data, err := s.Read(ChangeCoveragePath)
	if err != nil {
		return err
	}
	_, err = parseChangeCoverage(data)
	return err
}

func taskChangeCoverage(s *repository.Snapshot, t Task) (*ChangeCoverageModel, error) {
	f, exists := fileMap(t.Baseline)[ChangeCoveragePath]
	if !exists {
		return nil, nil // 導入前Taskの記録・必須条件を維持する。
	}
	if f.Type != "regular" {
		return nil, fail("CHANGE_COVERAGE", ChangeCoveragePath, "開始時モデルはregular fileでなければなりません")
	}
	data, err := s.Git(context.Background(), "show", t.BaselineHead+":"+ChangeCoveragePath)
	if err != nil {
		return nil, err
	}
	if canonical.HashBytes(data) != f.SHA256 {
		return nil, fail("CHANGE_COVERAGE", ChangeCoveragePath, "開始時inventoryとモデルが一致しません")
	}
	return parseChangeCoverage(data)
}

func validCoverageStatus(status, reason string) bool {
	return (status == "affected" || status == "unaffected" || status == "not-applicable") && strings.TrimSpace(reason) != ""
}

func (l *Loaded) validateChangeCoverage(d Decision, paths map[string]bool, changed bool) error {
	m := l.ChangeCoverageModel
	if m == nil {
		if len(d.ChangeCoverage) != 0 {
			return fail("CHANGE_COVERAGE", l.Task.Spec.ID, "開始時モデルのないTaskでは既存のmanual caseで検討を記録してください")
		}
		return nil
	}
	axes := map[string]bool{}
	for _, a := range m.Axes {
		axes[a.ID] = true
	}
	reps := map[string]bool{}
	for _, r := range d.Target.Representations {
		reps[r.Path] = owned(r.Path, d.Target.OwnershipScopes)
	}
	cases := map[string]bool{}
	for _, c := range d.Target.VerificationCases {
		cases[c.ID] = true
	}
	covered := map[string]bool{}
	affected := map[string]bool{}
	baseline := fileMap(l.changeBaseline())
	concepts := map[string]bool{}
	for _, c := range d.ChangeCoverage {
		if strings.TrimSpace(c.ID) == "" || concepts[c.ID] || strings.TrimSpace(c.Concept) == "" || len(c.Representations) == 0 {
			return fail("CHANGE_COVERAGE", c.ID, "一意の概念ID・説明・検討対象representationが必要です")
		}
		concepts[c.ID] = true
		localPaths := map[string]bool{}
		for _, r := range c.Representations {
			if _, err := pathcontract.ValidateRelativePath(r.Path); err != nil {
				return err
			}
			if localPaths[r.Path] || !validCoverageStatus(r.Status, r.Reason) {
				return fail("CHANGE_COVERAGE", r.Path, "representationは重複せず、判定と理由が必要です")
			}
			// 削除予定のfileは最終representationに置かず、所有する変更基準点のfileで照合する。
			_, existed := baseline[r.Path]
			if r.Status == "affected" && !reps[r.Path] && !(existed && owned(r.Path, d.Target.OwnershipScopes)) {
				return fail("CHANGE_COVERAGE", r.Path, "affectedなrepresentationは所有する最終成果物または削除対象fileでなければなりません")
			}
			localPaths[r.Path], covered[r.Path] = true, true
			if r.Status == "affected" {
				affected[r.Path] = true
			}
		}
		seen := map[string]bool{}
		for _, p := range c.Patterns {
			if !axes[p.Axis] || seen[p.Axis] || strings.TrimSpace(p.Scenario) == "" || !validCoverageStatus(p.Status, p.Reason) {
				return fail("CHANGE_COVERAGE", c.ID+":"+p.Axis, "各必須軸に具体的な実行パターン・判定・理由を1件記録してください")
			}
			seen[p.Axis] = true
			if p.Status == "affected" && len(p.VerificationCaseIDs) == 0 {
				return fail("CHANGE_COVERAGE", c.ID+":"+p.Axis, "affectedなパターンには検証caseが必要です")
			}
			refs := map[string]bool{}
			for _, id := range p.VerificationCaseIDs {
				if !cases[id] || refs[id] {
					return fail("CHANGE_COVERAGE", id, "検証caseの参照が不明または重複しています")
				}
				refs[id] = true
			}
		}
		for _, axis := range m.Axes {
			if !seen[axis.ID] {
				return fail("CHANGE_COVERAGE", c.ID+":"+axis.ID, "必須軸の判定がありません")
			}
		}
	}
	for _, p := range slices.Sorted(maps.Keys(paths)) {
		if rules.MatchesPath(m.Paths, p) && (!covered[p] || changed && !affected[p]) {
			return fail("CHANGE_COVERAGE", p, "対象pathの概念とCoverage判定がありません")
		}
	}
	return nil
}

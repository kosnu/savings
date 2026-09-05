package protocol

import (
	"context"
	"slices"

	"github.com/kosnu/savings/tools/aidd/checker/internal/catalog"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
)

// CheckConfigurationはcandidate側の文書・policy・profileの参照整合を検査する。
// Learnでも開始時checkerの実装で実行し、candidate自身の成功だけに依存しない。
func CheckConfiguration(ctx context.Context, snapshot *repository.Snapshot) error {
	content, err := snapshot.Read(PolicyPath)
	if err != nil {
		return err
	}
	p, err := parsePolicy(content)
	if err != nil {
		return err
	}
	for _, patterns := range [][]string{p.GuardrailPaths, p.ProductPaths} {
		if err = rules.ValidatePatterns(patterns, PolicyPath); err != nil {
			return err
		}
	}
	r, err := rules.Load(snapshot, rules.DefaultPath)
	if err != nil {
		return err
	}
	c, err := catalog.Load(snapshot, catalog.DefaultPath)
	if err != nil {
		return err
	}
	for _, rule := range r.Map.Rules {
		if _, err = snapshot.Read(rule.File); err != nil {
			return err
		}
	}
	mixedPaths := map[string]bool{}
	for _, rule := range p.MixedJSON {
		if err = validateMixed(rule); err != nil {
			return err
		}
		if mixedPaths[rule.Path] || !rules.MatchesPath(p.GuardrailPaths, rule.Path) {
			return fail("MIXED_POLICY", rule.Path, "混在設定は一意のguardrail pathへ指定してください")
		}
		mixedPaths[rule.Path] = true
	}
	allDiffCheck := false
	for _, route := range p.RequiredVerification {
		if err = rules.ValidatePatterns(route.Paths, PolicyPath); err != nil {
			return err
		}
		if slices.Contains(route.Paths, "**") && slices.Contains(route.Profiles, "git-diff-check") {
			allDiffCheck = true
		}
		for _, id := range route.Profiles {
			profile, ok := c.Profiles[id]
			if !ok || profile.Contract != "suite" {
				return fail("POLICY_PROFILE", id, "必須検証はcatalog内のsuiteを参照してください")
			}
		}
	}
	if !allDiffCheck {
		return fail("POLICY_PROFILE", PolicyPath, "全変更のgit-diff-checkを必須にしてください")
	}
	return snapshot.AssertUnchanged()
}

// Package repositorypolicyはrepository固有の方針を読み取り、Coreへ宣言として渡す。
package repositorypolicy

import (
	_ "embed"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/rules"
	"slices"
)

const Path = "docs/ai-driven-development/contracts/repository-policy.json"

//go:embed legacy.json
var legacy []byte

type ConditionalVerification struct {
	Paths    []string `json:"paths"`
	Detector string   `json:"detector"`
	Value    string   `json:"value"`
	Profiles []string `json:"profiles"`
}
type Policy struct {
	SchemaVersion           int                       `json:"schema_version"`
	Kind                    string                    `json:"kind"`
	ForbiddenTreeScopes     []string                  `json:"forbidden_tree_scopes"`
	ConditionalVerification []ConditionalVerification `json:"conditional_verification"`
	RunnerArgvPrefixes      map[string][]string       `json:"runner_argv_prefixes"`
}

// Legacyはpolicy導入以前のTaskと歴史artifactだけに使う固定互換契約。
func Legacy() Policy {
	p, err := Parse(legacy)
	if err != nil {
		panic(err)
	}
	return p
}
func Parse(data []byte) (Policy, error) {
	var p Policy
	if err := canonical.Decode(data, Path, &p); err != nil {
		return p, err
	}
	if p.SchemaVersion != 1 || p.Kind != "aidd_repository_policy" || p.ForbiddenTreeScopes == nil || p.ConditionalVerification == nil || p.RunnerArgvPrefixes == nil {
		return p, fmt.Errorf("repository policy contract is incomplete")
	}
	seen := map[string]bool{}
	for _, path := range p.ForbiddenTreeScopes {
		if _, err := pathcontract.ValidateRelativePath(path); err != nil {
			return p, err
		}
		if seen[path] {
			return p, fmt.Errorf("duplicate forbidden scope: %s", path)
		}
		seen[path] = true
	}
	for _, route := range p.ConditionalVerification {
		if len(route.Paths) == 0 || len(route.Profiles) == 0 || route.Detector != "storybook_tag_text" || route.Value == "" {
			return p, fmt.Errorf("unsupported conditional verification: %+v", route)
		}
		if err := rules.ValidatePatterns(route.Paths, Path); err != nil {
			return p, err
		}
	}
	for name, argv := range p.RunnerArgvPrefixes {
		if name != "vitest_json" && name != "python_unittest" || len(argv) == 0 {
			return p, fmt.Errorf("unsupported runner policy: %s", name)
		}
		for _, arg := range argv {
			if arg == "" {
				return p, fmt.Errorf("empty runner argument")
			}
		}
	}
	return p, nil
}
func (p Policy) ValidateProfiles(profiles map[string]model.VerificationProfile) error {
	for _, r := range p.ConditionalVerification {
		for _, id := range r.Profiles {
			profile, ok := profiles[id]
			if !ok || profile.Contract != "suite" {
				return fmt.Errorf("conditional verification requires suite %s", id)
			}
		}
	}
	for _, profile := range profiles {
		if prefix, ok := p.RunnerArgvPrefixes[profile.Runner]; ok && (len(profile.Argv) < len(prefix) || !slices.Equal(profile.Argv[:len(prefix)], prefix)) {
			return fmt.Errorf("runner %s argv violates repository policy", profile.Runner)
		}
	}
	return nil
}

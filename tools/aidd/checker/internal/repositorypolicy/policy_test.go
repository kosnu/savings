package repositorypolicy

import (
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"testing"
)

func TestPolicyOwnsRunnerChoiceAndRejectsMissingSuites(t *testing.T) {
	p := Legacy()
	p.ConditionalVerification = []ConditionalVerification{}
	profiles := map[string]model.VerificationProfile{"test": {Runner: "vitest_json", Argv: []string{"npx", "vitest"}}}
	if p.ValidateProfiles(profiles) == nil {
		t.Fatal("repository invocation policy bypassed")
	}
	p.RunnerArgvPrefixes["vitest_json"] = []string{"npx"}
	if err := p.ValidateProfiles(profiles); err != nil {
		t.Fatal(err)
	}
	p.ConditionalVerification = []ConditionalVerification{{Paths: []string{"src/**"}, Detector: "storybook_tag_text", Value: "tag", Profiles: []string{"missing"}}}
	if p.ValidateProfiles(profiles) == nil {
		t.Fatal("unknown suite accepted")
	}
}
func TestPolicyRejectsMalformedAndUnknownDeclarations(t *testing.T) {
	for _, variant := range []string{"version", "detector", "pattern", "scope", "missing", "runner"} {
		t.Run(variant, func(t *testing.T) {
			p := Legacy()
			switch variant {
			case "version":
				p.SchemaVersion = 2
			case "detector":
				p.ConditionalVerification[0].Detector = "arbitrary-command"
			case "pattern":
				p.ConditionalVerification[0].Paths = []string{"src/a**"}
			case "scope":
				p.ForbiddenTreeScopes = []string{"../outside"}
			case "missing":
				p.ForbiddenTreeScopes = nil
			case "runner":
				p.RunnerArgvPrefixes["unknown"] = []string{"run"}
			}
			data, err := canonical.Pretty(p)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = Parse(data); err == nil {
				t.Fatal("invalid policy accepted")
			}
		})
	}
}

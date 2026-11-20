package core

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func command(t *testing.T, root string, args ...string) string {
	t.Helper()
	b, e := git(root, args...)
	if e != nil {
		t.Fatal(e)
	}
	return strings.TrimSpace(string(b))
}
func put(t *testing.T, root, path, text string) {
	t.Helper()
	full := filepath.Join(root, path)
	if e := os.MkdirAll(filepath.Dir(full), 0755); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(full, []byte(text), 0644); e != nil {
		t.Fatal(e)
	}
}
func fixture(t *testing.T) *Checker {
	t.Helper()
	root := t.TempDir()
	command(t, root, "init", "-b", "main")
	command(t, root, "config", "user.email", "test@example.com")
	command(t, root, "config", "user.name", "test")
	put(t, root, "docs/harness/rule-map.json", `{"version":2,"rules":[],"review_routing":{}}`)
	put(t, root, "code.txt", "before\n")
	command(t, root, "add", ".")
	command(t, root, "commit", "-m", "baseline")
	return &Checker{Root: root, Base: command(t, root, "rev-parse", "HEAD")}
}
func TestRulesClosureAndFailure(t *testing.T) {
	root := t.TempDir()
	put(t, root, "a.md", "a")
	put(t, root, "b.md", "b")
	put(t, root, "c.md", "c")
	rm := `{"version":2,"rules":[{"id":"a","file":"a.md","applies_to":{"paths":["src/**"]},"depends_on":["b"]},{"id":"b","file":"b.md","applies_to":{"paths":[]}},{"id":"c","file":"c.md","applies_to":{"paths":[]}}],"review_routing":{"governed_paths":["src/**","missing/**"],"surfaces":[{"id":"src","paths":["src/**"],"required_rules":["a"]}]}}`
	put(t, root, "docs/harness/rule-map.json", rm)
	r, e := ResolveRules(root, []string{"src/deep/x.go"})
	if e != nil || len(r) != 2 {
		t.Fatalf("%v %v", r, e)
	}
	if _, e = ResolveRules(root, []string{"missing/file"}); e == nil {
		t.Fatal("unmapped path accepted")
	}
	put(t, root, "docs/harness/rule-map.json", strings.Replace(rm, "src/**", "src/[", 1))
	if _, e = ResolveRules(root, nil); e == nil {
		t.Fatal("malformed glob accepted")
	}
}

func TestRepositoryReviewRouting(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..", "..")
	feedback := "policy.review-feedback-classification"
	audit := "policy.audit"
	for _, tc := range []struct {
		path     string
		required []string
		excluded []string
	}{
		{"apps/web/src/features/budgets/removeMonthlyBudget/removeMonthlyBudget.ts", []string{"domain.monthly-budget", "policy.transaction-boundaries"}, nil},
		{"apps/web/src/features/payments/listPayment/RecentPayments/RecentPayments.tsx", []string{"web.query-cache", "web.suspense-boundaries"}, nil},
		{"docs/harness/domain/amount.md", []string{"domain.amount"}, []string{"domain.date", "policy.temporal-data"}},
		{"docs/harness/domain/payment.md", []string{"domain.payment", "policy.temporal-data"}, nil},
		{".agents/skills/release/SKILL.md", []string{"infrastructure.production-release"}, []string{"policy.issue-template-selection"}},
		{"docs/ai-driven-development/issue-guidelines.md", []string{"policy.issue-template-selection"}, nil},
		{"apps/web/src/assets/reset.css", []string{"policy.code-review", "web.design-system-brand", "web.design-rules"}, []string{"domain.payment", "domain.monthly-budget", "domain.user", "policy.temporal-data", "policy.transaction-boundaries", "web.query-cache", "web.storybook-browser-tests"}},
		{"apps/web/src/features/payments/listPayment/PaymentCategoryFilter/PaymentCategoryFilter.module.css", []string{"web.design-rules"}, []string{"domain.payment", "web.feature-directory", "web.domain-ui-rules"}},
		{"apps/web/src/features/payments/monthlySpending/fetchMonthlySpending.ts", []string{"domain.payment", "domain.date", "domain.amount", "domain.category"}, []string{"domain.user", "web.storybook-browser-tests"}},
		{"apps/api/supabase/migrations/20260901000000_enforce_monthly_budget_record_write_boundary.sql", []string{"domain.monthly-budget", "policy.temporal-data", "policy.transaction-boundaries", "policy.query-performance"}, []string{"domain.payment"}},
		{"apps/api/supabase/tests/ensure_authenticated_user.test.sql", []string{"domain.user", "policy.transaction-boundaries"}, []string{"domain.monthly-budget", "domain.payment"}},
		{"apps/web/src/app/routes/HomePage/HomePage.stories.tsx", []string{"policy.code-review", "web.storybook-browser-tests"}, []string{feedback, audit}},
		{"docs/architecture.md", []string{"documentation.policy"}, []string{feedback, audit}},
		{".github/workflows/harness_checker_ci.yaml", []string{"ai-driven.checker"}, []string{feedback, audit}},
		{"docs/harness/policies/review-feedback-classification.md", []string{feedback, audit, "policy.git-workflow"}, nil},
		{".agents/skills/audit/SKILL.md", []string{"ai-driven.audit", audit, feedback}, nil},
		{".agents/skills/guardrail-improvement/SKILL.md", []string{"ai-driven.audit", audit, feedback}, nil},
	} {
		t.Run(tc.path, func(t *testing.T) {
			rules, err := ResolveRules(root, []string{tc.path})
			if err != nil {
				t.Fatal(err)
			}
			selected := map[string]bool{}
			for _, rule := range rules {
				selected[rule.ID] = true
			}
			for _, id := range tc.required {
				if !selected[id] {
					t.Errorf("required rule %s was not selected", id)
				}
			}
			for _, id := range tc.excluded {
				if selected[id] {
					t.Errorf("unrelated rule %s was selected", id)
				}
			}
		})
	}
}

func TestReviewFeedbackPolicyEntryPoints(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..", "..", "docs", "harness", "policies")
	for _, path := range []string{"code-review.md", "git-workflow.md", "audit.md"} {
		t.Run(path, func(t *testing.T) {
			body, err := os.ReadFile(filepath.Join(root, path))
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(body), "](review-feedback-classification.md)") {
				t.Error("review feedback policy link is missing")
			}
		})
	}
}

func TestADRHistorySelectsCanonicalPolicyOnly(t *testing.T) {
	root := t.TempDir()
	put(t, root, "docs/harness/policies/documentation-policy.md", "current")
	put(t, root, "docs/adr/0001-example.md", "history")
	rm := `{"version":2,"rules":[{"id":"documentation.policy","file":"docs/harness/policies/documentation-policy.md","applies_to":{"paths":["docs/**/*.md"]}}],"review_routing":{"governed_paths":["docs/adr/**"],"surfaces":[{"id":"adr-history","paths":["docs/adr/**"],"required_rules":["documentation.policy"]}]}}`
	put(t, root, "docs/harness/rule-map.json", rm)
	r, e := ResolveRules(root, []string{"docs/adr/0001-example.md"})
	if e != nil || len(r) != 1 || r[0].ID != "documentation.policy" {
		t.Fatalf("ADR history routing: %v %v", r, e)
	}
	put(t, root, "docs/harness/rule-map.json", strings.Replace(rm, `"file":"docs/harness/policies/documentation-policy.md"`, `"file":"docs/adr/0001-example.md"`, 1))
	if _, e := ResolveRules(root, []string{"docs/adr/0001-example.md"}); e == nil {
		t.Fatal("ADR history accepted as required rule")
	}
	put(t, root, "apps/web/docs/adr/0001-example.md", "history")
	put(t, root, "docs/harness/rule-map.json", strings.Replace(rm, `"file":"docs/harness/policies/documentation-policy.md"`, `"file":"apps/web/docs/adr/0001-example.md"`, 1))
	if _, e := ResolveRules(root, []string{"docs/adr/0001-example.md"}); e == nil {
		t.Fatal("app ADR history accepted as required rule")
	}
	other := "docs/decisions/example.md"
	put(t, root, "docs/harness/rule-map.json", strings.Replace(rm, `"file":"docs/harness/policies/documentation-policy.md"`, `"file":"`+other+`"`, 1))
	for _, tc := range []struct {
		name     string
		content  string
		rejected bool
	}{
		{"unquoted ADR", "---\ndoc_type: adr\n---\n# VerificationPlan\n", true},
		{"quoted ADR", "---\ndoc_type: 'adr' # history\n---\n# VerificationPlan\n", true},
		{"BOM and CRLF ADR", "\ufeff---\r\ndoc_type: \"adr\"\r\n---\r\n# VerificationPlan\r\n", true},
		{"current policy", "---\ndoc_type: policy\n---\n# Policy\n", false},
		{"body mention", "# Policy\n\ndoc_type: adr\n", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			put(t, root, other, tc.content)
			_, e := ResolveRules(root, []string{other})
			if (e != nil) != tc.rejected {
				t.Fatalf("ADR type rejection = %v, want %v: %v", e != nil, tc.rejected, e)
			}
		})
	}
}
func TestStrictJSON(t *testing.T) {
	var x VerificationPlan
	for _, v := range []string{`{"unknown":1}`, `{} trailing`, `{} {}`} {
		if decode([]byte(v), &x) == nil {
			t.Fatal(v)
		}
	}
	b, _ := json.Marshal(VerificationPlan{})
	if e := decode(b, &x); e != nil {
		t.Fatal(e)
	}
}
func TestMandatoryChecks(t *testing.T) {
	if (&Checker{}).requireCommands([]string{"tools/harness/checker/x.go"}, VerificationPlan{Commands: [][]string{{"true"}}}) == nil {
		t.Fatal("mandatory checks absent")
	}
	if _, e := exec.LookPath("git"); e != nil {
		t.Fatal(e)
	}
}

func TestWebVerificationApplicability(t *testing.T) {
	s := fixture(t)
	has := func(paths []string, cmd string) bool {
		for _, c := range s.mandatoryCommands(paths) {
			if strings.Join(c, " ") == cmd {
				return true
			}
		}
		return false
	}
	if has([]string{"apps/web/docs/policy.md"}, "pnpm run web:lint") {
		t.Fatal("docs require app verification")
	}
	put(t, s.Root, "apps/web/src/example.stories.tsx", "export default {};")
	if has([]string{"apps/web/src/example.stories.tsx"}, "pnpm run web:test:storybook") {
		t.Fatal("untagged story needs browser suite")
	}
	put(t, s.Root, "apps/web/src/example.stories.tsx", "tags: ['browser-test']")
	if !has([]string{"apps/web/src/example.stories.tsx"}, "pnpm run web:test:storybook") {
		t.Fatal("tagged story omitted")
	}
}
func TestGlobRejectsMidSegmentDoubleStar(t *testing.T) {
	for _, pattern := range []string{"src/**foo", "src/foo**bar", "src/***"} {
		if _, e := glob(pattern, "src/foo"); e == nil {
			t.Fatal("invalid glob accepted", pattern)
		}
	}
	if ok, e := glob("src/**/*.go", "src/file.go"); e != nil || !ok {
		t.Fatal(ok, e)
	}
}

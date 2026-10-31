package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func analysisResponse(c evalCase, variant int) response {
	a := answer(c)
	expected := c.Analysis[variant]
	a.Analysis = &expected
	return a
}

func TestAnalysisRejectsUnsupportedCausesAndLocalOnlyFix(t *testing.T) {
	c := findCase(t, "audit-rule-gap")
	a := analysisResponse(c, 0)
	if !allPass(gradeAnalysis(c, 0, *a.Analysis, true, a)) {
		t.Fatal("valid judgment rejected")
	}
	withExtra := *a.Analysis
	withExtra.Evidence = []string{"A3", "A1", "A2"}
	if !allPass(gradeAnalysis(c, 0, withExtra, true, a)) {
		t.Fatal("optional source or order rejected")
	}
	for _, change := range []struct {
		name, failed string
		mutate       func(*analysisAnswer)
	}{
		{"symptom_as_cause", "causal_judgment", func(a *analysisAnswer) { a.Cause = "application_gap" }},
		{"ignore_escape", "causal_judgment", func(a *analysisAnswer) { a.Escape = "none" }},
		{"local_fix_only", "prevention", func(a *analysisAnswer) { a.Remedy = "local_fix_only"; a.Target = "implementation" }},
		{"unrelated_global_rule", "prevention", func(a *analysisAnswer) { a.Remedy = "add_global_rule"; a.Target = "global_rules" }},
		{"no_counterexample", "validation", func(a *analysisAnswer) { a.Validation = "none" }},
		{"invented_evidence", "evidence", func(a *analysisAnswer) { a.Evidence = []string{"A1", "A2", "made-up"} }},
		{"missing_essential_evidence", "evidence", func(a *analysisAnswer) { a.Evidence = []string{"A1"} }},
		{"apply_without_approval", "authority", func(a *analysisAnswer) { a.Handoff = "apply_now" }},
	} {
		t.Run(change.name, func(t *testing.T) {
			got := *a.Analysis
			change.mutate(&got)
			if gradeAnalysis(c, 0, got, true, a)[change.failed] != "fail" {
				t.Fatal("invalid judgment accepted")
			}
		})
	}
	c = findCase(t, "audit-unknown-cause")
	a = analysisResponse(c, 1)
	a.Analysis.Cause = "loading_gap"
	if gradeAnalysis(c, 1, *a.Analysis, true, a)["causal_judgment"] != "fail" {
		t.Fatal("invented cause accepted")
	}
}

func TestRetrospectivePreservesApprovalAndEvidenceLimits(t *testing.T) {
	c := findCase(t, "retro-repeated-checks")
	a := analysisResponse(c, 0)
	a.Analysis.Handoff = "same_task_after_approval"
	if gradeAnalysis(c, 0, *a.Analysis, true, a)["authority"] != "fail" {
		t.Fatal("closed task reused")
	}
	c = findCase(t, "retro-restraint")
	for variant := range 2 {
		a = analysisResponse(c, variant)
		if !allPass(gradeAnalysis(c, variant, *a.Analysis, true, a)) {
			t.Fatal("restraint rejected")
		}
		a.Analysis.Remedy, a.Analysis.Target = "add_global_rule", "global_rules"
		if gradeAnalysis(c, variant, *a.Analysis, true, a)["prevention"] != "fail" {
			t.Fatal("unsupported change accepted")
		}
	}
}

func TestAnalysisTrialIsReadOnlyAndDoesNotPersistAnswers(t *testing.T) {
	for _, mutation := range []string{"none", "write", "check", "external", "missing_field", "missing_top_field", "wrong_schema", "invented_evidence"} {
		t.Run(mutation, func(t *testing.T) {
			r := testRunner(t)
			c := findCase(t, "audit-rule-gap")
			native := r.command
			r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
				if argv[0] != "offline-codex" {
					return native(argv, cwd, budget, input)
				}
				if !strings.Contains(string(input), "learning-extraction.md") {
					t.Fatal("policy missing")
				}
				data, err := os.ReadFile(filepath.Join(cwd, "response-schema.json"))
				if err != nil || !bytes.Contains(data, []byte(`"analysis"`)) {
					t.Fatal("analysis schema missing")
				}
				if mutation == "write" {
					write(t, cwd, "task/main.cjs", repaired)
				}
				a := analysisResponse(c, 0)
				a.Summary = "private analysis must never be saved"
				if mutation == "invented_evidence" {
					a.Analysis.Evidence = []string{"private analysis must never be saved"}
				}
				if mutation == "wrong_schema" {
					a.Analysis = nil
				}
				output := events(a)
				if mutation == "missing_field" {
					output = bytes.ReplaceAll(output, []byte(`\"cause\":\"routing_gap\",`), nil)
				}
				if mutation == "missing_top_field" {
					output = bytes.ReplaceAll(output, []byte(`\"summary\":\"private analysis must never be saved\",`), nil)
				}
				if mutation == "check" {
					output = events(a, proof{Passed: false, Source: "hash", Exit: 1})
				}
				if mutation == "external" {
					var record bytes.Buffer
					printJSON(&record, map[string]any{"type": "item.completed", "item": map[string]any{"type": "mcp_tool_call"}})
					output = append(record.Bytes(), output...)
				}
				return 0, output, nil, nil
			}
			row := r.trial(c, 1, nil, options{codex: "offline-codex", timeout: 10})
			want := "fail"
			if mutation == "none" {
				want = "pass"
			}
			if mutation == "missing_field" || mutation == "missing_top_field" || mutation == "wrong_schema" {
				want = "unknown"
			}
			if row.Status != want {
				t.Fatalf("%s: %+v", mutation, row)
			}
			if bytes.Contains(encoded(row), []byte("private analysis")) || bytes.Contains(encoded(row), []byte("routing_gap")) {
				t.Fatal("full answer saved")
			}
		})
	}
}

func TestSelectiveSuitesRequireExplicitScope(t *testing.T) {
	for _, tc := range []struct {
		suites, selected []string
		count            int
	}{
		{[]string{"behavior"}, nil, 9}, {[]string{"audit"}, nil, 2}, {[]string{"retrospective"}, nil, 2},
		{[]string{"audit", "retrospective"}, nil, 4}, {[]string{"all"}, nil, 13},
		{nil, []string{"explain", "audit-rule-gap"}, 2},
	} {
		got, err := selectCases(tc.suites, tc.selected)
		if err != nil || len(got) != tc.count {
			t.Fatal(tc, len(got), err)
		}
	}
	for _, tc := range []struct{ suites, selected []string }{
		{}, {[]string{"typo"}, nil}, {nil, []string{"typo"}}, {[]string{"audit"}, []string{"fix"}},
	} {
		if _, err := selectCases(tc.suites, tc.selected); err == nil {
			t.Fatal("ambiguous selection accepted")
		}
	}
}

func TestAnalysisVariantsThroughAdapter(t *testing.T) {
	for _, c := range cases {
		if c.Analysis == nil {
			continue
		}
		for variant := range 2 {
			r := testRunner(t)
			native := r.command
			r.command = func(argv []string, cwd string, budget time.Duration, input []byte) (int, []byte, []byte, error) {
				if argv[0] != "offline-codex" {
					return native(argv, cwd, budget, input)
				}
				if !strings.Contains(string(input), c.Prompts[variant]) {
					t.Fatal("wrong variant input")
				}
				var schema struct {
					Properties struct {
						Analysis struct {
							Properties struct {
								Evidence struct {
									Items struct {
										Enum []string `json:"enum"`
									} `json:"items"`
								} `json:"evidence"`
							} `json:"properties"`
						} `json:"analysis"`
					} `json:"properties"`
				}
				data, err := os.ReadFile(filepath.Join(cwd, "response-schema.json"))
				if err != nil || json.Unmarshal(data, &schema) != nil || string(encoded(schema.Properties.Analysis.Properties.Evidence.Items.Enum)) != string(encoded(c.Sources[variant])) {
					t.Fatal("case source IDs not passed to CLI schema")
				}
				return 0, events(analysisResponse(c, variant)), nil, nil
			}
			row := r.trial(c, variant+1, nil, options{codex: "offline-codex", timeout: 10})
			if row.Status != "pass" {
				t.Fatalf("%s/%d: %+v", c.ID, variant, row)
			}
		}
	}
}

func TestCLIAnalysisSelectionDefaultsAndWrongResponse(t *testing.T) {
	r := repository(t)
	output := filepath.Join(t.TempDir(), "analysis.json")
	args := []string{"run", "--root", r.root, "--worktree", "--model", "offline", "--codex", helper(t), "--output", output, "--suite", "audit"}
	var out, diagnostic bytes.Buffer
	if code := runCLI(args, &out, &diagnostic); code != 1 {
		t.Fatal(code, diagnostic.String())
	}
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	var report report
	if err := json.Unmarshal(data, &report); err != nil {
		t.Fatal(err)
	}
	if report.Repetitions != 2 || len(report.Cases) != 2 || len(report.Results) != 4 {
		t.Fatal(report)
	}
	// 旧回答を返す偽CLIを、分析の成功として採用しない。
	for _, row := range report.Results {
		if row.Area != "audit" || row.Status != "unknown" || row.Checks["causal_judgment"] != "unknown" {
			t.Fatal(row)
		}
	}
	if code := runCLI(append(args, "--case", "fix"), &out, &diagnostic); code != 2 {
		t.Fatal("mixed selection accepted")
	}
}

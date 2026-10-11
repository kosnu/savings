package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (s *Checker) mandatoryCommands(paths []string) [][]string {
	out := [][]string{{"git", "diff", "--check"}}
	goCode, metrics, web, story := false, false, false, false
	for _, p := range paths {
		if strings.HasPrefix(p, "tools/aidd/checker/") {
			goCode = true
		}
		if strings.HasPrefix(p, "tools/aidd/session-metrics/") {
			metrics = true
		}
		appRuntime := strings.HasPrefix(p, "apps/web/") && !strings.HasPrefix(p, "apps/web/docs/") && !strings.HasSuffix(p, ".md")
		if appRuntime || p == "package.json" || p == "pnpm-lock.yaml" || p == "pnpm-workspace.yaml" || p == "vite.config.ts" || strings.HasPrefix(p, "tsconfig") {
			web = true
		}
		if strings.HasPrefix(p, "apps/web/.storybook-test/") || p == "apps/web/.storybook/preview.tsx" || p == "apps/web/.storybook/vitest.setup.ts" || p == "apps/web/vitest.config.ts" {
			story = true
		}
		if appRuntime && (strings.Contains(p, ".stories.") || strings.Contains(p, "storybook")) {
			now, _ := os.ReadFile(filepath.Join(s.Root, p))
			before, _ := git(s.Root, "show", s.Base+":"+p)
			if strings.Contains(string(now), "browser-test") || strings.Contains(string(before), "browser-test") {
				story = true
			}
		}
	}
	if goCode {
		out = append(out, []string{"go", "-C", "tools/aidd/checker", "test", "./..."}, []string{"go", "-C", "tools/aidd/checker", "vet", "./..."})
	}
	if metrics {
		out = append(out, []string{"go", "-C", "tools/aidd/session-metrics", "test", "./..."}, []string{"go", "-C", "tools/aidd/session-metrics", "vet", "./..."})
	}
	if web {
		for _, name := range []string{"web:lint", "web:format-check", "web:typecheck", "web:test:unit-integration"} {
			out = append(out, []string{"pnpm", "run", name})
		}
	}
	if story {
		out = append(out, []string{"pnpm", "run", "web:test:storybook"})
	}
	return out
}
func (s *Checker) requireCommands(paths []string, d VerificationPlan) error {
	for _, want := range s.mandatoryCommands(paths) {
		found := false
		for _, got := range d.Commands {
			normalized := []string{}
			for _, arg := range got {
				if arg != "-count=1" || len(got) < 4 || got[0] != "go" || got[3] != "test" {
					normalized = append(normalized, arg)
				}
			}
			if digest(want) == digest(normalized) {
				found = true
			}
		}
		if !found {
			return fmt.Errorf("required verification command absent: %v", want)
		}
	}
	return nil
}

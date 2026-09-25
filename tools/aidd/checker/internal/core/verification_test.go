package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorkspaceConfigurationRequiresWebChecks(t *testing.T) {
	s := fixture(t)
	paths := []string{"pnpm-workspace.yaml"}
	want := [][]string{{"git", "diff", "--check"}, {"pnpm", "run", "web:lint"}, {"pnpm", "run", "web:format-check"}, {"pnpm", "run", "web:typecheck"}, {"pnpm", "run", "web:test:unit-integration"}}
	if got := s.mandatoryCommands(paths); digest(got) != digest(want) {
		t.Fatalf("workspace verification: %v", got)
	}
	for i := 1; i < len(want); i++ {
		without := append([][]string{}, want[:i]...)
		without = append(without, want[i+1:]...)
		if s.requireCommands(paths, Decision{Commands: without}) == nil {
			t.Fatalf("missing Web command accepted: %v", want[i])
		}
	}
	if e := s.requireCommands(paths, Decision{Commands: want}); e != nil {
		t.Fatal(e)
	}
	if got := s.mandatoryCommands([]string{"docs/workspace.md"}); len(got) != 1 {
		t.Fatalf("unrelated documentation requires Web checks: %v", got)
	}
}

func TestSharedBrowserConfigurationCommands(t *testing.T) {
	for _, path := range []string{"apps/web/.storybook/preview.tsx", "apps/web/.storybook/vitest.setup.ts", "apps/web/vitest.config.ts", "apps/web/.storybook-test/main.ts"} {
		t.Run(path, func(t *testing.T) {
			s := fixture(t)
			// tag文字列がなくても追加・変更・削除の各状態でbrowser suiteを要求する。
			for _, present := range []bool{true, false} {
				if present {
					put(t, s.Root, path, "export default {}\n")
				} else {
					os.Remove(filepath.Join(s.Root, path))
				}
				commands := s.mandatoryCommands([]string{path})
				found := false
				without := [][]string{}
				for _, c := range commands {
					if c[len(c)-1] == "web:test:storybook" {
						found = true
					} else {
						without = append(without, c)
					}
				}
				if !found {
					t.Fatal("browser suite missing")
				}
				if s.requireCommands([]string{path}, Decision{Commands: without}) == nil {
					t.Fatal("missing browser suite accepted")
				}
				if err := s.requireCommands([]string{path}, Decision{Commands: commands}); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
	s := fixture(t)
	for _, path := range []string{"apps/web/.storybook/main.ts", "apps/web/docs/policies/storybook-browser-tests.md"} {
		put(t, s.Root, path, "browser-test documentation or catalog config\n")
		if path == "apps/web/.storybook/main.ts" {
			put(t, s.Root, path, "export default {}\n")
		}
		for _, c := range s.mandatoryCommands([]string{path}) {
			if c[len(c)-1] == "web:test:storybook" {
				t.Fatal("unrelated file requires browser suite", path)
			}
		}
	}
}

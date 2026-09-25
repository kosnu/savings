package core

import (
	"os"
	"path/filepath"
	"testing"
)

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

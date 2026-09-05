package protocol

import (
	"context"
	"encoding/json"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"os"
	"path/filepath"
	"testing"
)

func setupMixed(t *testing.T, kind string) *fixture {
	f := setup(t, kind)
	must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
	f.put("package.json", `{"name":"test","scripts":{"test":"run-trusted","build":"build-product"},"dependencies":{"react":"1"},"devDependencies":{"vitest":"1"}}`)
	data, err := os.ReadFile(filepath.Join(f.root, PolicyPath))
	must(t, err)
	var p Policy
	must(t, json.Unmarshal(data, &p))
	p.GuardrailPaths = append(p.GuardrailPaths, "package.json")
	p.MixedJSON = []MixedJSONRule{{Path: "package.json", ProductFields: []string{"/dependencies", "/devDependencies", "/scripts/build"}, GuardFields: []string{"/dependencies/vitest", "/devDependencies/vitest"}}}
	b, err := json.Marshal(p)
	must(t, err)
	f.put(PolicyPath, string(b))
	f.git("add", ".")
	f.git("commit", "-qm", "mixed baseline")
	if kind == "learn" {
		f.spec.AuthorizedScopes = []model.OwnershipScope{{Path: "package.json", Kind: "file"}}
	}
	must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
		f.taskHash, err = Start(context.Background(), s, f.spec)
		return
	}))
	f.decision.TaskSHA256 = f.taskHash
	f.decision.Target.OwnershipScopes[0].Path = "package.json"
	f.decision.Target.Representations[0].Path = "package.json"
	return f
}

func TestMixedConfigSeparatesProductAndGuardrail(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		for _, field := range []string{"product", "guardrail", "tool", "move-tool", "delete"} {
			t.Run(kind+"/"+field, func(t *testing.T) {
				f := setupMixed(t, kind)
				must(t, f.checkpoint())
				body := `{"name":"test","scripts":{"test":"run-trusted","build":"build-product"},"dependencies":{"react":"1"},"devDependencies":{"vitest":"1"}}`
				var obj map[string]any
				must(t, json.Unmarshal([]byte(body), &obj))
				switch field {
				case "product":
					obj["dependencies"].(map[string]any)["react"] = "2"
				case "guardrail":
					obj["scripts"].(map[string]any)["test"] = "skip"
				case "tool":
					obj["devDependencies"].(map[string]any)["vitest"] = "2"
				case "move-tool":
					delete(obj["devDependencies"].(map[string]any), "vitest")
					obj["dependencies"].(map[string]any)["vitest"] = "1"
				case "delete":
					must(t, os.Remove(filepath.Join(f.root, "package.json")))
				}
				if field != "delete" {
					b, err := json.Marshal(obj)
					must(t, err)
					f.put("package.json", string(b))
				}
				err := f.verify()
				if kind == "development" && field == "product" || kind == "learn" && (field == "guardrail" || field == "tool" || field == "move-tool") {
					must(t, err)
				} else {
					rejected(t, err, "")
				}
			})
		}
	}
}

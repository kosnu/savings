package protocol

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestCheckerProfileRerunsForExternalInputs(t *testing.T) {
	data, err := os.ReadFile("../../../../../docs/ai-driven-development/contracts/verification-profiles.json")
	must(t, err)
	var catalog struct {
		Profiles []struct {
			ID   string   `json:"id"`
			Argv []string `json:"argv"`
		} `json:"profiles"`
	}
	must(t, json.Unmarshal(data, &catalog))
	var argv []string
	for _, p := range catalog.Profiles {
		if p.ID == "aidd-checker-tests" {
			argv = p.Argv
		}
	}
	if len(argv) == 0 {
		t.Fatal("checker検証profileがない")
	}
	root := t.TempDir()
	module := filepath.Join(root, "module")
	must(t, os.Mkdir(module, 0700))
	must(t, os.WriteFile(filepath.Join(module, "go.mod"), []byte("module cachefixture\n\ngo 1.24\n"), 0600))
	must(t, os.WriteFile(filepath.Join(module, "external_test.go"), []byte(`package cachefixture
import ("os"; "testing")
func TestExternal(t *testing.T) {
 b, err := os.ReadFile("../contract.txt")
 if err != nil { t.Fatal(err) }
 if string(b) != "valid" { t.Fatal("external contract mismatch") }
}
`), 0600))
	// 同じGoソース・cacheで、module外の入力だけを変更する。
	for _, value := range []string{"valid", "valid", "wrong", "valid"} {
		must(t, os.WriteFile(filepath.Join(root, "contract.txt"), []byte(value), 0600))
		command := exec.Command(argv[0], argv[1:]...)
		command.Dir = module
		for _, item := range os.Environ() {
			key, _, _ := strings.Cut(item, "=")
			switch key {
			case "GOFLAGS", "GOWORK", "GOENV", "GO111MODULE":
				continue
			}
			command.Env = append(command.Env, item)
		}
		command.Env = append(command.Env, "GOFLAGS=", "GOWORK=off", "GOENV=off", "GO111MODULE=on")
		output, err := command.CombinedOutput()
		if value == "wrong" {
			if err == nil || !strings.Contains(string(output), "external contract mismatch") {
				t.Fatalf("古い成功を再利用または別原因で失敗: %v\n%s", err, output)
			}
		} else if err != nil {
			t.Fatalf("正常入力を拒否: %v\n%s", err, output)
		}
	}
}

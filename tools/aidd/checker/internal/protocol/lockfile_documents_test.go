package protocol

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"go.yaml.in/yaml/v3"
)

const toolchainLock = `lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
    packageManagerDependencies:
      pnpm: {specifier: '12.2.1', version: '12.2.1'}
packages:
  pnpm@12.2.1: {resolution: {integrity: pnpm-old}}
  platform@1: {resolution: {integrity: platform-old}}
snapshots:
  pnpm@12.2.1:
    optionalDependencies: {platform: '1'}
  platform@1: {}
`

func encodeLockDocuments(t *testing.T, docs ...map[string]any) []byte {
	t.Helper()
	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(4)
	for _, doc := range docs {
		must(t, enc.Encode(doc))
	}
	must(t, enc.Close())
	return buf.Bytes()
}

func TestPNPM12ActualLockfile(t *testing.T) {
	// CI run 34226686753 / eccbc7049557d4e2d40a622b6f44c118ad81f11c の実物から必要な依存だけを抜粋。
	data, err := os.ReadFile("testdata/pnpm-v12-lock.yaml")
	must(t, err)
	lock, err := decodeLock(data)
	must(t, err)
	if lock.Toolchain == nil {
		t.Fatal("toolchain document missing")
	}
	policy, err := os.ReadFile("../../../../../" + PolicyPath)
	must(t, err)
	p, err := parsePolicy(policy)
	must(t, err)
	l := Loaded{Policy: p}
	tools := l.toolNames()
	for _, guard := range []bool{false, true} {
		original, err := projectLock(lock.Workspace, tools, lockProductNames(lock.Workspace, tools), guard, nil)
		must(t, err)
		// YAML再出力でコメント・字下げ・key順序を変えても同じ意味で扱う。
		rewritten, err := decodeLock(encodeLockDocuments(t, lock.Toolchain, lock.Workspace))
		must(t, err)
		projected, err := projectLock(rewritten.Workspace, tools, lockProductNames(rewritten.Workspace, tools), guard, nil)
		must(t, err)
		if hash(original) != hash(projected) || hash(lock.Toolchain) != hash(rewritten.Toolchain) {
			t.Fatal("format changed dependency meaning")
		}
	}
}

func TestLockfileDocumentStructure(t *testing.T) {
	for name, data := range map[string]string{
		"empty":            "",
		"null":             "null\n",
		"sequence":         "[]\n",
		"scalar":           "hello\n",
		"trailing-empty":   sampleLock + "---\n",
		"three":            toolchainLock + "---\n" + sampleLock + "---\n" + sampleLock,
		"reversed":         sampleLock + "---\n" + toolchainLock,
		"two-workspace":    sampleLock + "---\n" + sampleLock,
		"two-toolchain":    toolchainLock + "---\n" + toolchainLock,
		"toolchain-alone":  toolchainLock,
		"second-null":      toolchainLock + "---\nnull\n",
		"second-sequence":  toolchainLock + "---\n[]\n",
		"second-syntax":    toolchainLock + "---\n[\n",
		"first-duplicate":  toolchainLock + "packages: {}\n---\n" + sampleLock,
		"second-duplicate": toolchainLock + "---\n" + sampleLock + "settings: {}\n",
		"second-version":   toolchainLock + "---\n" + strings.Replace(sampleLock, "'9.0'", "'10.0'", 1),
		"first-version":    strings.Replace(toolchainLock, "'9.0'", "'10.0'", 1) + "---\n" + sampleLock,
		"missing-packages": strings.Replace(toolchainLock, "packages:", "other:", 1) + "---\n" + sampleLock,
		"null-importer":    strings.Replace(toolchainLock, "configDependencies: {}", "configDependencies: null", 1) + "---\n" + sampleLock,
		"unknown-section":  strings.Replace(toolchainLock, "configDependencies", "unknownDependencies", 1) + "---\n" + sampleLock,
	} {
		t.Run(name, func(t *testing.T) { _, err := decodeLock([]byte(data)); rejected(t, err, "") })
	}
}

func TestTwoDocumentReferencesStayWithinDocument(t *testing.T) {
	for _, document := range []string{"toolchain", "workspace"} {
		for _, missing := range []string{"snapshot", "package", "peer-variant"} {
			t.Run(document+"/"+missing, func(t *testing.T) {
				lock, err := decodeLock([]byte(toolchainLock + "---\n" + sampleLock))
				must(t, err)
				target, other, key := lock.Toolchain, lock.Workspace, "platform@1"
				if document == "workspace" {
					target, other, key = other, target, "helper@1"
				}
				// 他文書に同じidentityがあっても欠落した参照を補完しない。
				object(other["packages"])[key] = object(target["packages"])[key]
				object(other["snapshots"])[key] = object(target["snapshots"])[key]
				switch missing {
				case "snapshot":
					delete(object(target["snapshots"]), key)
				case "package":
					delete(object(target["packages"]), key)
				case "peer-variant":
					object(target["snapshots"])[key+"(peer@1)"] = object(target["snapshots"])[key]
					delete(object(target["snapshots"]), key)
				}
				parsed, err := decodeLock(encodeLockDocuments(t, lock.Toolchain, lock.Workspace))
				if err == nil {
					_, err = projectLock(parsed.Workspace, map[string]bool{"vitest": true}, map[string]bool{"react": true}, true, nil)
				}
				rejected(t, err, "LOCKFILE")
			})
		}
	}
}

func TestTwoDocumentLockfileBoundaries(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		for _, change := range []string{"format", "add-toolchain", "remove-toolchain", "toolchain", "toolchain-transitive", "config", "product", "tool", "shared-peer", "peer-update"} {
			t.Run(kind+"/"+change, func(t *testing.T) {
				workspace := sampleLock
				if change == "shared-peer" || change == "peer-update" {
					protected, opposite := "vitest", "react"
					if kind == "learn" {
						protected, opposite = opposite, protected
					}
					workspace = qualifiedLock(protected, opposite, "1", change == "shared-peer")
				}
				before := toolchainLock + "---\n" + workspace
				if change == "add-toolchain" {
					before = workspace
				}
				f := setupMixed(t, kind)
				must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
				f.put(lockPath, before)
				f.git("add", ".")
				f.git("commit", "-qm", "two document baseline")
				if kind == "learn" {
					f.spec.AuthorizedScopes = append(f.spec.AuthorizedScopes, model.OwnershipScope{Path: lockPath, Kind: "file"})
				}
				must(t, f.snapshot(func(s *repository.Snapshot) (err error) {
					f.taskHash, err = Start(context.Background(), s, f.spec)
					return
				}))
				f.decision.TaskSHA256 = f.taskHash
				f.decision.Target.OwnershipScopes = append(f.decision.Target.OwnershipScopes, model.OwnershipScope{Path: lockPath, Kind: "file"})
				rep := f.decision.Target.Representations[0]
				rep.ID, rep.Path = "REP-2", lockPath
				f.decision.Target.Representations = append(f.decision.Target.Representations, rep)
				must(t, f.checkpoint())
				next := before
				allowed := false
				switch change {
				case "format":
					lock, err := decodeLock([]byte(before))
					must(t, err)
					next = string(encodeLockDocuments(t, lock.Toolchain, lock.Workspace))
					allowed = true
				case "add-toolchain":
					next = toolchainLock + "---\n" + workspace
					allowed = kind == "learn"
				case "remove-toolchain":
					next = workspace
					allowed = kind == "learn"
				case "toolchain":
					next = strings.Replace(next, "pnpm-old", "pnpm-new", 1)
					allowed = kind == "learn"
				case "toolchain-transitive":
					next = strings.Replace(next, "platform-old", "platform-new", 1)
					allowed = kind == "learn"
				case "config":
					next = strings.Replace(next, "configDependencies: {}", "configDependencies: {config: {specifier: 'npm:pnpm@12.2.1', version: 'pnpm@12.2.1'}}", 1)
					allowed = kind == "learn"
				case "product":
					next = strings.Replace(next, "react-old", "react-new", 1)
					allowed = kind == "development"
				case "tool":
					next = strings.Replace(next, "vitest-old", "vitest-new", 1)
					allowed = kind == "learn"
				case "shared-peer", "peer-update":
					protected, opposite := "vitest", "react"
					if kind == "learn" {
						protected, opposite = opposite, protected
					}
					next = toolchainLock + "---\n" + qualifiedLock(protected, opposite, "2", change == "shared-peer")
					packageData, err := os.ReadFile(filepath.Join(f.root, "package.json"))
					must(t, err)
					f.put("package.json", strings.ReplaceAll(string(packageData), `"`+opposite+`":"1"`, `"`+opposite+`":"2"`))
					allowed = change == "peer-update"
				}
				f.put(lockPath, next)
				err := f.verify()
				if allowed {
					must(t, err)
				} else {
					rejected(t, err, "LOCKFILE_BOUNDARY")
				}
			})
		}
	}
}

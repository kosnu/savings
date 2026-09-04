package protocol

import (
	"context"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleLock = `lockfileVersion: '9.0'
settings: {autoInstallPeers: true}
importers:
  .:
    dependencies:
      react: {specifier: '1', version: '1'}
    devDependencies:
      vitest: {specifier: '1', version: '1'}
packages:
  react@1: {resolution: {integrity: react-old}}
  vitest@1: {resolution: {integrity: vitest-old}}
  helper@1: {resolution: {integrity: helper-old}}
snapshots:
  react@1: {}
  vitest@1:
    dependencies: {helper: '1'}
  helper@1: {}
`

func TestLockfileTracksProductAndToolClosure(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		for _, change := range []string{"product", "product-version", "tool", "tool-version", "transitive", "settings"} {
			t.Run(kind+"/"+change, func(t *testing.T) {
				f := setupMixed(t, kind)
				must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
				f.put(lockPath, sampleLock)
				f.git("add", ".")
				f.git("commit", "-qm", "lock baseline")
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
				rep.ID = "REP-2"
				rep.Path = lockPath
				f.decision.Target.Representations = append(f.decision.Target.Representations, rep)
				must(t, f.checkpoint())
				next := sampleLock
				switch change {
				case "product":
					next = strings.ReplaceAll(next, "react-old", "react-new")
				case "product-version":
					next = strings.ReplaceAll(next, "react@1", "react@2")
					next = strings.ReplaceAll(next, "react: {specifier: '1', version: '1'}", "react: {specifier: '2', version: '2'}")
					packageData, err := os.ReadFile(filepath.Join(f.root, "package.json"))
					must(t, err)
					f.put("package.json", strings.ReplaceAll(string(packageData), `"react":"1"`, `"react":"2"`))
				case "tool-version":
					next = strings.ReplaceAll(next, "vitest@1", "vitest@2")
					next = strings.ReplaceAll(next, "vitest: {specifier: '1', version: '1'}", "vitest: {specifier: '2', version: '2'}")
					packageData, err := os.ReadFile(filepath.Join(f.root, "package.json"))
					must(t, err)
					f.put("package.json", strings.ReplaceAll(string(packageData), `"vitest":"1"`, `"vitest":"2"`))
				case "tool":
					next = strings.ReplaceAll(next, "vitest-old", "vitest-new")
				case "transitive":
					next = strings.ReplaceAll(next, "helper-old", "helper-new")
				case "settings":
					next = strings.ReplaceAll(next, "autoInstallPeers: true", "autoInstallPeers: false")
				}
				f.put(lockPath, next)
				err := f.verify()
				if kind == "development" && strings.HasPrefix(change, "product") || kind == "learn" && !strings.HasPrefix(change, "product") {
					must(t, err)
				} else {
					rejected(t, err, "")
				}
			})
		}
	}
}

func TestLockfileRejectsBrokenClosureAndDuplicateKeys(t *testing.T) {
	root, err := decodeLock(sampleLockBytes())
	must(t, err)
	delete(object(root["snapshots"]), "helper@1")
	_, err = projectLock(root, map[string]bool{"vitest": true}, map[string]bool{"react": true}, true)
	rejected(t, err, "LOCKFILE")
	_, err = decodeLock([]byte(sampleLock + "settings: {}\n"))
	rejected(t, err, "")
}
func sampleLockBytes() []byte { return []byte(sampleLock) }

func TestRepositoryLockfileCanBeProjected(t *testing.T) {
	// 実repositoryのalias・peer suffix・optional dependenciesも通す。
	data, err := os.ReadFile("../../../../../pnpm-lock.yaml")
	must(t, err)
	policy, err := os.ReadFile("../../../../../" + PolicyPath)
	must(t, err)
	p, err := parsePolicy(policy)
	must(t, err)
	l := Loaded{Policy: p}
	root, err := decodeLock(data)
	must(t, err)
	for _, guard := range []bool{true, false} {
		_, err = projectLock(root, l.toolNames(), lockProductNames(root, l.toolNames()), guard)
		must(t, err)
	}
}

func TestLockfileDelegatesOnlyRootCoveredPeers(t *testing.T) {
	for _, peer := range []bool{false, true} {
		for _, covered := range []bool{false, true} {
			root, err := decodeLock(sampleLockBytes())
			must(t, err)
			deps := object(object(object(root["importers"])["."])["dependencies"])
			version := "2"
			if covered {
				version = "1"
			}
			deps["helper"] = map[string]any{"specifier": version, "version": version}
			object(root["packages"])["helper@2"] = map[string]any{"resolution": "helper-two"}
			object(root["snapshots"])["helper@2"] = map[string]any{}
			if peer {
				object(object(root["packages"])["vitest@1"])["peerDependencies"] = map[string]any{"helper": "*"}
			}
			tools := map[string]bool{"vitest": true}
			products := lockProductNames(root, tools)
			before, err := projectLock(root, tools, products, true)
			must(t, err)
			beforeHash := hash(before)
			object(object(root["packages"])["helper@1"])["resolution"] = "changed"
			after, err := projectLock(root, tools, products, true)
			must(t, err)
			if (beforeHash == hash(after)) != (peer && covered) {
				t.Fatalf("peer=%v covered=%v: shared dependency boundary mismatch", peer, covered)
			}
		}
	}
}

func TestLockfileAllowsOppositeRootPeerVersionUpdate(t *testing.T) {
	root, err := decodeLock(sampleLockBytes())
	must(t, err)
	object(object(root["packages"])["vitest@1"])["peerDependencies"] = map[string]any{"react": "*"}
	object(object(root["snapshots"])["vitest@1"])["dependencies"] = map[string]any{"react": "1"}
	tools := map[string]bool{"vitest": true}
	products := lockProductNames(root, tools)
	before, err := projectLock(root, tools, products, true)
	must(t, err)
	object(object(object(object(root["importers"])["."])["dependencies"])["react"])["version"] = "2"
	object(root["packages"])["react@2"] = map[string]any{"resolution": "new-react"}
	object(root["snapshots"])["react@2"] = map[string]any{}
	object(object(root["snapshots"])["vitest@1"])["dependencies"] = map[string]any{"react": "2"}
	after, err := projectLock(root, tools, products, true)
	must(t, err)
	if hash(before) != hash(after) {
		t.Fatal("product root peer update blocked tool closure")
	}
}

func TestLockfileRejectsLocalDependencies(t *testing.T) {
	for _, version := range []string{"link:../helper", "file:../helper", "file:../@scope/helper"} {
		for _, guard := range []bool{true, false} {
			root, err := decodeLock(sampleLockBytes())
			must(t, err)
			object(object(root["snapshots"])["vitest@1"])["dependencies"] = map[string]any{"helper": version}
			object(object(root["snapshots"])["react@1"])["dependencies"] = map[string]any{"helper": version}
			_, err = projectLock(root, map[string]bool{"vitest": true}, map[string]bool{"react": true}, guard)
			rejected(t, err, "LOCKFILE")
		}
	}
}

func TestLockfileDoesNotDelegateDifferentPeerSnapshot(t *testing.T) {
	root, err := decodeLock(sampleLockBytes())
	must(t, err)
	object(object(object(root["importers"])["."])["dependencies"])["helper"] = map[string]any{"specifier": "1", "version": "1(peer@2)"}
	object(object(root["packages"])["vitest@1"])["peerDependencies"] = map[string]any{"helper": "*"}
	object(root["snapshots"])["helper@1(peer@2)"] = map[string]any{}
	tools := map[string]bool{"vitest": true}
	products := lockProductNames(root, tools)
	before, err := projectLock(root, tools, products, true)
	must(t, err)
	beforeHash := hash(before)
	object(object(root["packages"])["helper@1"])["resolution"] = "different peer snapshot changed"
	after, err := projectLock(root, tools, products, true)
	must(t, err)
	if beforeHash == hash(after) {
		t.Fatal("uncovered peer variant was delegated")
	}
}

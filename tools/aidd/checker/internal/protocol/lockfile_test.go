package protocol

import (
	"context"
	"fmt"
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
	_, err = projectLock(root, map[string]bool{"vitest": true}, map[string]bool{"react": true}, true, nil)
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
		_, err = projectLock(root, l.toolNames(), lockProductNames(root, l.toolNames()), guard, nil)
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
			before, err := projectLock(root, tools, products, true, nil)
			must(t, err)
			beforeHash := hash(before)
			object(object(root["packages"])["helper@1"])["resolution"] = "changed"
			after, err := projectLock(root, tools, products, true, nil)
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
	before, err := projectLock(root, tools, products, true, nil)
	must(t, err)
	object(object(object(object(root["importers"])["."])["dependencies"])["react"])["version"] = "2"
	object(root["packages"])["react@2"] = map[string]any{"resolution": "new-react"}
	object(root["snapshots"])["react@2"] = map[string]any{}
	object(object(root["snapshots"])["vitest@1"])["dependencies"] = map[string]any{"react": "2"}
	after, err := projectLock(root, tools, products, true, nil)
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
			_, err = projectLock(root, map[string]bool{"vitest": true}, map[string]bool{"react": true}, guard, nil)
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
	before, err := projectLock(root, tools, products, true, nil)
	must(t, err)
	beforeHash := hash(before)
	object(object(root["packages"])["helper@1"])["resolution"] = "different peer snapshot changed"
	after, err := projectLock(root, tools, products, true, nil)
	must(t, err)
	if beforeHash == hash(after) {
		t.Fatal("uncovered peer variant was delegated")
	}
}

func TestLockfilePreservesPeerVariantEdgesAndRootAssignments(t *testing.T) {
	for _, wantTools := range []bool{true, false} {
		for _, swap := range []string{"edges", "roots"} {
			t.Run(fmt.Sprintf("tools=%v/%s", wantTools, swap), func(t *testing.T) {
				root, err := decodeLock(sampleLockBytes())
				must(t, err)
				packages, snapshots := object(root["packages"]), object(root["snapshots"])
				packages["foo@1"] = map[string]any{"resolution": "same-package", "peerDependencies": map[string]any{"peer": "*"}}
				for _, v := range []string{"1", "2"} {
					packages["peer@"+v] = map[string]any{"resolution": "peer-" + v}
					snapshots["peer@"+v] = map[string]any{}
					snapshots["foo@1(peer@"+v+")"] = map[string]any{"dependencies": map[string]any{"peer": v}}
				}
				rootName := "react"
				if wantTools {
					rootName = "vitest"
				}
				object(snapshots[rootName+"@1"])["dependencies"] = map[string]any{"parent-a": "1", "parent-b": "1"}
				for _, p := range []string{"parent-a", "parent-b"} {
					packages[p+"@1"] = map[string]any{"resolution": p}
				}
				snapshots["parent-a@1"] = map[string]any{"dependencies": map[string]any{"foo": "1(peer@1)"}}
				snapshots["parent-b@1"] = map[string]any{"dependencies": map[string]any{"foo": "1(peer@2)"}}
				tools := map[string]bool{"vitest": true}
				if swap == "roots" {
					for _, p := range []string{"parent-a", "parent-b"} {
						tools[p] = wantTools
					}
					object(object(root["importers"])["."])["optionalDependencies"] = map[string]any{
						"parent-a": map[string]any{"specifier": "npm:foo@1", "version": "foo@1(peer@1)"},
						"parent-b": map[string]any{"specifier": "npm:foo@1", "version": "foo@1(peer@2)"},
					}
				}
				products := lockProductNames(root, tools)
				before, err := projectLock(root, tools, products, wantTools, nil)
				must(t, err)
				digest := hash(before)
				if swap == "edges" {
					object(object(snapshots["parent-a@1"])["dependencies"])["foo"] = "1(peer@2)"
					object(object(snapshots["parent-b@1"])["dependencies"])["foo"] = "1(peer@1)"
				} else {
					refs := object(object(object(root["importers"])["."])["optionalDependencies"])
					object(refs["parent-a"])["version"] = "foo@1(peer@2)"
					object(refs["parent-b"])["version"] = "foo@1(peer@1)"
				}
				after, err := projectLock(root, tools, products, wantTools, nil)
				must(t, err)
				if digest == hash(after) {
					t.Fatal("peer variant reassignment did not change protected projection")
				}
			})
		}
	}
}

func qualifiedLock(protected, opposite, version string, shared bool) string {
	sharedDependency := "{}"
	if shared {
		sharedDependency = fmt.Sprintf("\n    dependencies: {%s: '%s'}", opposite, version)
	}
	return fmt.Sprintf(`lockfileVersion: '9.0'
settings: {autoInstallPeers: true}
importers:
  .:
    dependencies:
      %[1]s: {specifier: '1', version: '1(bridge@1(%[2]s@%[3]s))(%[2]s@%[3]s)'}
      %[2]s: {specifier: '%[3]s', version: '%[3]s'}
packages:
  %[1]s@1: {resolution: protected, peerDependencies: {%[2]s: '*'}}
  %[2]s@%[3]s: {resolution: 'opposite-%[3]s'}
  bridge@1: {resolution: bridge, peerDependencies: {%[2]s: '*'}}
  helper@1: {resolution: helper}
snapshots:
  %[1]s@1(bridge@1(%[2]s@%[3]s))(%[2]s@%[3]s):
    dependencies: {bridge: '1(%[2]s@%[3]s)', %[2]s: '%[3]s', helper: '1'}
  bridge@1(%[2]s@%[3]s):
    dependencies: {%[2]s: '%[3]s'}
  %[2]s@%[3]s: {}
  helper@1: %[4]s
`, protected, opposite, version, sharedDependency)
}

func TestLockfileAllowsQualifiedOppositePeerUpdatesButProtectsSharedDependencies(t *testing.T) {
	for _, kind := range []string{"development", "learn"} {
		for _, shared := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/shared=%v", kind, shared), func(t *testing.T) {
				protected, opposite := "vitest", "react"
				if kind == "learn" {
					protected, opposite = opposite, protected
				}
				f := setupMixed(t, kind)
				must(t, os.RemoveAll(filepath.Join(f.root, TaskRoot)))
				f.put(lockPath, qualifiedLock(protected, opposite, "1", shared))
				f.git("add", ".")
				f.git("commit", "-qm", "qualified peer baseline")
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
				packageData, err := os.ReadFile(filepath.Join(f.root, "package.json"))
				must(t, err)
				f.put("package.json", strings.ReplaceAll(string(packageData), `"`+opposite+`":"1"`, `"`+opposite+`":"2"`))
				f.put(lockPath, qualifiedLock(protected, opposite, "2", shared))
				err = f.verify()
				if shared {
					rejected(t, err, "LOCKFILE_BOUNDARY")
				} else {
					must(t, err)
				}
			})
		}
	}
}

func TestLockfileRejectsAmbiguousPeerRootUpdates(t *testing.T) {
	for _, change := range []string{"unchanged", "different", "deleted"} {
		t.Run(change, func(t *testing.T) {
			before, err := decodeLock([]byte(qualifiedLock("vitest", "react", "1", false)))
			must(t, err)
			after, err := decodeLock([]byte(qualifiedLock("vitest", "react", "2", false)))
			must(t, err)
			object(before["importers"])["other"] = map[string]any{"dependencies": map[string]any{"react": map[string]any{"version": "1"}}}
			if change != "deleted" {
				version := "1"
				if change == "different" {
					version = "3"
				}
				object(after["importers"])["other"] = map[string]any{"dependencies": map[string]any{"react": map[string]any{"version": version}}}
			}
			tools := map[string]bool{"vitest": true}
			updates := peerRootUpdates(before, after, tools, true)
			ap, err := projectLock(before, tools, lockProductNames(before, tools), true, updates)
			must(t, err)
			bp, err := projectLock(after, tools, lockProductNames(before, tools), true, nil)
			must(t, err)
			if hash(ap) == hash(bp) {
				t.Fatal("ambiguous counterpart update allowed a protected peer rename")
			}
		})
	}
}

func TestLockfileRejectsPeerRenameContentCollision(t *testing.T) {
	root, err := decodeLock([]byte(qualifiedLock("vitest", "react", "1", false)))
	must(t, err)
	object(object(object(root["importers"])["."])["dependencies"])["alias"] = map[string]any{"version": "bridge@1(react@2)"}
	object(root["snapshots"])["bridge@1(react@2)"] = map[string]any{"optional": true}
	tools := map[string]bool{"vitest": true, "alias": true}
	_, err = projectLock(root, tools, lockProductNames(root, tools), true, map[string]string{"react@1": "react@2"})
	rejected(t, err, "LOCKFILE_BOUNDARY")
}

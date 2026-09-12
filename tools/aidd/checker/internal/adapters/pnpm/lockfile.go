package pnpm

import (
	"bytes"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"go.yaml.in/yaml/v3"
	"io"
	"strings"
)

const lockPath = "pnpm-lock.yaml"

func object(v any) map[string]any { m, _ := v.(map[string]any); return m }
func versionBase(v string) string { base, _, _ := strings.Cut(v, "("); return base }
func dependencyKey(name, version string) string {
	// pnpmのnpm aliasはversion側が完全package名を持つ。
	if strings.Contains(versionBase(version), "@") {
		return version
	}
	return name + "@" + version
}

type lockfile struct {
	Workspace map[string]any
	Toolchain map[string]any
}

func Decode(data []byte) (lockfile, error) {
	var result lockfile
	dec := yaml.NewDecoder(bytes.NewReader(data))
	var docs []map[string]any
	for {
		var root map[string]any
		if err := dec.Decode(&root); err == io.EOF {
			break
		} else if err != nil {
			return result, err
		}
		if len(docs) == 2 || root == nil {
			return result, fail("LOCKFILE", lockPath, "1または2個のYAML mapping documentが必要です")
		}
		if fmt.Sprint(root["lockfileVersion"]) != "9.0" || object(root["importers"]) == nil || object(root["packages"]) == nil || object(root["snapshots"]) == nil {
			return result, fail("LOCKFILE", lockPath, "pnpm lockfile v9のimporters/packages/snapshotsが必要です")
		}
		docs = append(docs, root)
	}
	if len(docs) == 0 {
		return result, fail("LOCKFILE", lockPath, "lockfile documentが必要です")
	}
	for i, doc := range docs {
		toolchain := len(docs) == 2 && i == 0
		sections := 0
		for importer, raw := range object(doc["importers"]) {
			if object(raw) == nil {
				return result, fail("LOCKFILE", importer, "importer objectが必要です")
			}
			for section, deps := range object(raw) {
				if !lockDependencySection(section, toolchain) || object(deps) == nil {
					return result, fail("LOCKFILE", section, "文書の役割に対応する依存objectが必要です")
				}
				sections++
			}
		}
		if toolchain && sections == 0 {
			return result, fail("LOCKFILE", lockPath, "先頭documentにはpackage manager/config依存が必要です")
		}
	}
	result.Workspace = docs[len(docs)-1]
	if len(docs) == 2 {
		result.Toolchain = docs[0]
		// 文書を混ぜず、package manager/config依存も自身のclosureで検査する。
		if _, err := projectLockDocument(result.Toolchain, nil, nil, true, nil, true); err != nil {
			return result, err
		}
	}
	return result, nil
}

func lockDependencySection(section string, toolchain bool) bool {
	if toolchain {
		return section == "configDependencies" || section == "packageManagerDependencies"
	}
	return section == "dependencies" || section == "devDependencies" || section == "optionalDependencies"
}

type lockProjection struct {
	Roots     map[string]any
	Packages  map[string]any
	Snapshots map[string]string
}

// Only a consistent update at the same opposite-root declaration can rename a peer context.
func PeerRootUpdates(before, after map[string]any, tools map[string]bool, wantTools bool) map[string]string {
	updates := map[string]string{}
	for importer, raw := range object(before["importers"]) {
		for section, rawDeps := range object(raw) {
			for name, ref := range object(rawDeps) {
				if tools[name] == wantTools {
					continue
				}
				oldVersion, ok := object(ref)["version"].(string)
				if !ok {
					continue
				}
				newRef := object(object(object(object(after["importers"])[importer])[section])[name])
				newVersion, ok := newRef["version"].(string)
				oldKey, newKey := dependencyKey(name, oldVersion), ""
				if ok {
					newKey = dependencyKey(name, newVersion)
				}
				if previous, seen := updates[oldKey]; seen && previous != newKey {
					newKey = ""
				}
				updates[oldKey] = newKey
			}
		}
	}
	return updates
}

// Rewrite only complete parenthesized peer identities, never the package's own version.
func peerContextKey(key string, updates map[string]string) (string, error) {
	base := versionBase(key)
	result := base
	for rest := key[len(base):]; rest != ""; {
		if rest[0] != '(' {
			return "", fail("LOCKFILE", key, "peer contextが不正です")
		}
		depth, end := 0, -1
		for i, c := range rest {
			if c == '(' {
				depth++
			} else if c == ')' {
				depth--
				if depth == 0 {
					end = i
					break
				}
			}
		}
		if end <= 1 {
			return "", fail("LOCKFILE", key, "peer contextが不正です")
		}
		peer := rest[1:end]
		if next, exists := updates[peer]; exists {
			if next != "" {
				peer = next
			}
		} else {
			var err error
			peer, err = peerContextKey(peer, updates)
			if err != nil {
				return "", err
			}
		}
		result += "(" + peer + ")"
		rest = rest[end+1:]
	}
	return result, nil
}

func Project(root map[string]any, tools, productRoots map[string]bool, wantTools bool, updates map[string]string) (lockProjection, error) {
	return projectLockDocument(root, tools, productRoots, wantTools, updates, false)
}

func projectLockDocument(root map[string]any, tools, productRoots map[string]bool, wantTools bool, updates map[string]string, toolchain bool) (lockProjection, error) {
	result := lockProjection{map[string]any{}, map[string]any{}, map[string]string{}}
	snapshots, packages := object(root["snapshots"]), object(root["packages"])
	rootVersions := map[string]map[string]bool{}
	for _, raw := range object(root["importers"]) {
		for _, section := range object(raw) {
			for name, ref := range object(section) {
				if version, ok := object(ref)["version"].(string); ok {
					if rootVersions[name] == nil {
						rootVersions[name] = map[string]bool{}
					}
					rootVersions[name][dependencyKey(name, version)] = true
				}
			}
		}
	}
	visited := map[string]bool{}
	var visit func(string) error
	visit = func(key string) error {
		if strings.HasPrefix(key, "link:") || strings.HasPrefix(key, "file:") || strings.Contains(key, "@link:") || strings.Contains(key, "@file:") {
			return fail("LOCKFILE", key, "local/file依存の実体検査は未対応です")
		}
		if visited[key] {
			return nil
		}
		visited[key] = true
		value, ok := snapshots[key]
		if !ok {
			return fail("LOCKFILE", key, "依存snapshotがありません")
		}
		snap := object(value)
		if snap == nil {
			return fail("LOCKFILE", key, "snapshot objectが必要です")
		}
		base := versionBase(key)
		pkg, ok := packages[base]
		if !ok {
			return fail("LOCKFILE", base, "package resolutionがありません")
		}
		result.Packages[base] = pkg
		normalized := map[string]any{}
		for field, v := range snap {
			if field != "dependencies" && field != "optionalDependencies" {
				normalized[field] = v
				continue
			}
			deps := object(v)
			if deps == nil {
				return fail("LOCKFILE", key, "dependencies objectが必要です")
			}
			resolved := map[string]string{}
			for name, ref := range deps {
				version, ok := ref.(string)
				if !ok {
					return fail("LOCKFILE", name, "依存versionが不正です")
				}
				key := dependencyKey(name, version)
				_, peer := object(object(pkg)["peerDependencies"])[name]
				opposite := wantTools && productRoots[name] && !tools[name] || !wantTools && tools[name]
				// 反対側rootが同じ解決先を担うpeerだけを委任し、通常の共有依存は両側で保護する。
				if peer && opposite && rootVersions[name][key] && !strings.HasPrefix(version, "link:") && !strings.HasPrefix(version, "file:") {
					continue
				}
				translated, err := peerContextKey(key, updates)
				if err != nil {
					return err
				}
				resolved[name] = translated
				if err := visit(key); err != nil {
					return err
				}
			}
			normalized[field] = resolved
		}
		translated, err := peerContextKey(key, updates)
		if err != nil {
			return err
		}
		digest := hash(normalized)
		if existing, ok := result.Snapshots[translated]; ok && existing != digest {
			return fail("LOCKFILE_BOUNDARY", key, "peer更新後のsnapshotが異なる依存内容へ衝突しています")
		}
		result.Snapshots[translated] = digest
		return nil
	}
	for importer, raw := range object(root["importers"]) {
		value := object(raw)
		if value == nil {
			return result, fail("LOCKFILE", importer, "importer objectが必要です")
		}
		for section, rawDeps := range value {
			if !lockDependencySection(section, toolchain) {
				return result, fail("LOCKFILE", section, "未対応importer fieldです")
			}
			deps := object(rawDeps)
			if deps == nil {
				return result, fail("LOCKFILE", section, "依存objectが必要です")
			}
			for name, rawRef := range deps {
				if !toolchain && tools[name] != wantTools {
					continue
				}
				ref := object(rawRef)
				version, ok := ref["version"].(string)
				if !ok {
					return result, fail("LOCKFILE", name, "importer versionが必要です")
				}
				rootRef := map[string]any{}
				for k, v := range ref {
					rootRef[k] = v
				}
				translated, err := peerContextKey(dependencyKey(name, version), updates)
				if err != nil {
					return result, err
				}
				rootRef["version"] = translated
				result.Roots[importer+"/"+section+"/"+name] = rootRef
				if err := visit(dependencyKey(name, version)); err != nil {
					return result, err
				}
			}
		}
	}
	return result, nil
}

func ProductNames(root map[string]any, tools map[string]bool) map[string]bool {
	result := map[string]bool{}
	for _, raw := range object(root["importers"]) {
		for _, rawDeps := range object(raw) {
			for name := range object(rawDeps) {
				if !tools[name] {
					result[name] = true
				}
			}
		}
	}
	return result
}

func fail(code, path, message string) error {
	return diagnostic.New("AIDD_VNEXT_"+code, path, "pnpm", message, nil, nil)
}
func hash(v any) string {
	b, err := canonical.Marshal(v)
	if err != nil {
		panic(err)
	}
	return canonical.HashBytes(b)
}

// Comparisonは技術的な差分のみを返す。どちらを保護するかは呼出側の契約で指定する。
type Comparison struct{ ClosureChanged, ToolchainChanged, SettingsChanged bool }

func Compare(before, after []byte, tools map[string]bool, protectTools bool) (Comparison, error) {
	var result Comparison
	a, err := Decode(before)
	if err != nil {
		return result, err
	}
	b, err := Decode(after)
	if err != nil {
		return result, err
	}
	products := ProductNames(a.Workspace, tools)
	ap, err := Project(a.Workspace, tools, products, protectTools, PeerRootUpdates(a.Workspace, b.Workspace, tools, protectTools))
	if err != nil {
		return result, err
	}
	bp, err := Project(b.Workspace, tools, products, protectTools, nil)
	if err != nil {
		return result, err
	}
	result.ClosureChanged = hash(ap) != hash(bp)
	result.ToolchainChanged = hash(a.Toolchain) != hash(b.Toolchain)
	for _, doc := range []map[string]any{a.Workspace, b.Workspace} {
		delete(doc, "importers")
		delete(doc, "packages")
		delete(doc, "snapshots")
	}
	result.SettingsChanged = hash(a.Workspace) != hash(b.Workspace)
	return result, nil
}

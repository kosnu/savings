package protocol

import (
	"bytes"
	"context"
	"fmt"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
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

func decodeLock(data []byte) (map[string]any, error) {
	var root map[string]any
	dec := yaml.NewDecoder(bytes.NewReader(data))
	if err := dec.Decode(&root); err != nil {
		return nil, err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		return nil, fail("LOCKFILE", lockPath, "単一YAML documentが必要です")
	}
	if fmt.Sprint(root["lockfileVersion"]) != "9.0" || object(root["importers"]) == nil || object(root["packages"]) == nil || object(root["snapshots"]) == nil {
		return nil, fail("LOCKFILE", lockPath, "pnpm lockfile v9のimporters/packages/snapshotsが必要です")
	}
	return root, nil
}

func (l *Loaded) toolNames() map[string]bool {
	result := map[string]bool{}
	for _, rule := range l.Policy.MixedJSON {
		for _, pointer := range rule.GuardFields {
			parts, err := pointerParts(pointer)
			if err == nil && len(parts) == 2 && (strings.HasSuffix(parts[0], "Dependencies") || parts[0] == "dependencies") {
				result[parts[1]] = true
			}
		}
	}
	return result
}

type lockProjection struct {
	Roots     map[string]any
	Packages  map[string]any
	Snapshots map[string]string
}

// Only a consistent update at the same opposite-root declaration can rename a peer context.
func peerRootUpdates(before, after map[string]any, tools map[string]bool, wantTools bool) map[string]string {
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

func projectLock(root map[string]any, tools, productRoots map[string]bool, wantTools bool, updates map[string]string) (lockProjection, error) {
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
			if section != "dependencies" && section != "devDependencies" && section != "optionalDependencies" {
				return result, fail("LOCKFILE", section, "未対応importer fieldです")
			}
			deps := object(rawDeps)
			if deps == nil {
				return result, fail("LOCKFILE", section, "依存objectが必要です")
			}
			for name, rawRef := range deps {
				if tools[name] != wantTools {
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

func lockProductNames(root map[string]any, tools map[string]bool) map[string]bool {
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

func (l *Loaded) checkLock(ctx context.Context, s *repository.Snapshot, files []File) error {
	before, ok := fileMap(l.Task.Baseline)[lockPath]
	after, exists := fileMap(files)[lockPath]
	if !ok || !exists || before.Type != "regular" || after.Type != "regular" || transportFiles([]File{before}, l.Delivered)[0].Mode != transportFiles([]File{after}, l.Delivered)[0].Mode {
		return fail("LOCKFILE", lockPath, "既存lockfileのtype/modeを保持してください")
	}
	if l.Task.Spec.Kind == "learn" && !owned(lockPath, l.Task.Spec.AuthorizedScopes) {
		return fail("LEARN_SCOPE", lockPath, "lockfileの明示ownershipが必要です")
	}
	old, err := s.Git(ctx, "show", l.Task.BaselineHead+":"+lockPath)
	if err != nil {
		return err
	}
	next, err := s.Read(lockPath)
	if err != nil {
		return err
	}
	a, err := decodeLock(old)
	if err != nil {
		return err
	}
	b, err := decodeLock(next)
	if err != nil {
		return err
	}
	tools := l.toolNames()
	productRoots := lockProductNames(a, tools)
	wantTools := l.Task.Spec.Kind == "development"
	ap, err := projectLock(a, tools, productRoots, wantTools, peerRootUpdates(a, b, tools, wantTools))
	if err != nil {
		return err
	}
	bp, err := projectLock(b, tools, productRoots, wantTools, nil)
	if err != nil {
		return err
	}
	if hash(ap) != hash(bp) {
		return fail("LOCKFILE_BOUNDARY", lockPath, "他方の依存宣言・resolution・推移依存を変更しています")
	}
	if wantTools {
		for _, root := range []map[string]any{a, b} {
			delete(root, "importers")
			delete(root, "packages")
			delete(root, "snapshots")
		}
		if hash(a) != hash(b) {
			return fail("GUARDRAIL_DRIFT", lockPath, "lockfileのsettings/catalog/overrideはguardrailです")
		}
	}
	return nil
}

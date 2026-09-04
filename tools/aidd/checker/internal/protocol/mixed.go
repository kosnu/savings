package protocol

import (
	"context"
	"encoding/json"
	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
	"strings"
)

// JSON Pointerで宣言したproduct fieldだけを可変にし、残りをguardrailとする。
// guard fieldはproduct subtreeより優先し、tool依存の削除・移動も検出する。
func pointerParts(pointer string) ([]string, error) {
	if !strings.HasPrefix(pointer, "/") || pointer == "/" {
		return nil, fail("MIXED_POLICY", pointer, "非空JSON Pointerが必要です")
	}
	parts := strings.Split(pointer[1:], "/")
	for i, part := range parts {
		for j := 0; j < len(part); j++ {
			if part[j] == '~' {
				if j+1 >= len(part) || (part[j+1] != '0' && part[j+1] != '1') {
					return nil, fail("MIXED_POLICY", pointer, "JSON Pointer escapeが不正です")
				}
				j++
			}
		}
		parts[i] = strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
	}
	return parts, nil
}

func validateMixed(rule MixedJSONRule) error {
	if _, err := pathcontract.ValidateRelativePath(rule.Path); err != nil {
		return err
	}
	if len(rule.ProductFields) == 0 {
		return fail("MIXED_POLICY", rule.Path, "product fieldが必要です")
	}
	seen := map[string]bool{}
	for _, p := range append(append([]string{}, rule.ProductFields...), rule.GuardFields...) {
		if _, err := pointerParts(p); err != nil {
			return err
		}
		if seen[p] {
			return fail("MIXED_POLICY", p, "重複fieldです")
		}
		seen[p] = true
	}
	return nil
}

func takePointer(root map[string]any, pointer string) (any, bool) {
	parts, _ := pointerParts(pointer)
	current := root
	for _, key := range parts[:len(parts)-1] {
		child, ok := current[key].(map[string]any)
		if !ok {
			return nil, false
		}
		current = child
	}
	key := parts[len(parts)-1]
	value, ok := current[key]
	delete(current, key)
	return value, ok
}

type fieldValue struct {
	Present bool
	Value   any
}

func projectJSON(content []byte, rule MixedJSONRule) (string, string, error) {
	var root map[string]any
	if err := canonical.Decode(content, rule.Path, &root); err != nil {
		return "", "", err
	}
	if root == nil {
		return "", "", fail("MIXED_JSON", rule.Path, "JSON objectが必要です")
	}
	// UseNumberにより大きな数値の丸めで変更を見逃さない。
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.UseNumber()
	if err := decoder.Decode(&root); err != nil {
		return "", "", err
	}
	guards := map[string]fieldValue{}
	for _, pointer := range rule.GuardFields {
		v, ok := takePointer(root, pointer)
		guards[pointer] = fieldValue{ok, v}
	}
	product := map[string]fieldValue{}
	for _, pointer := range rule.ProductFields {
		v, ok := takePointer(root, pointer)
		product[pointer] = fieldValue{ok, v}
	}
	return hash(struct {
		Remaining map[string]any
		Protected map[string]fieldValue
	}{root, guards}), hash(product), nil
}

func (l *Loaded) checkMixed(ctx context.Context, s *repository.Snapshot, rule MixedJSONRule, files []File) error {
	if err := validateMixed(rule); err != nil {
		return err
	}
	before, ok := fileMap(l.Task.Baseline)[rule.Path]
	after, exists := fileMap(files)[rule.Path]
	if !ok || !exists || before.Type != "regular" || after.Type != "regular" || transportFiles([]File{before}, l.Delivered)[0].Mode != transportFiles([]File{after}, l.Delivered)[0].Mode {
		return fail("MIXED_IDENTITY", rule.Path, "混在設定の削除・追加・type/mode変更は許可しません")
	}
	original, err := s.Git(ctx, "show", l.Task.BaselineHead+":"+rule.Path)
	if err != nil {
		return err
	}
	if canonical.HashBytes(original) != before.SHA256 {
		return fail("BASELINE", rule.Path, "Git baselineと一致しません")
	}
	current, err := s.Read(rule.Path)
	if err != nil {
		return err
	}
	guardBefore, productBefore, err := projectJSON(original, rule)
	if err != nil {
		return err
	}
	guardAfter, productAfter, err := projectJSON(current, rule)
	if err != nil {
		return err
	}
	if l.Task.Spec.Kind == "development" && guardBefore != guardAfter {
		return fail("GUARDRAIL_DRIFT", rule.Path, "Developmentは設定のguardrail fieldを変更できません")
	}
	if l.Task.Spec.Kind == "learn" && (productBefore != productAfter || !owned(rule.Path, l.Task.Spec.AuthorizedScopes)) {
		return fail("LEARN_SCOPE", rule.Path, "Learnは設定のproduct fieldを変更できません")
	}
	return nil
}

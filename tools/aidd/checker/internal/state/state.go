package state

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/model"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

type File struct {
	Path    string `json:"path"`
	Type    string `json:"type"`
	GitMode string `json:"git_mode"`
	SHA256  string `json:"sha256"`
}

type Manifest struct {
	Version           int    `json:"version"`
	TargetStateSHA256 string `json:"target_state_sha256"`
	Files             []File `json:"files"`
}

func Inventory(snapshot *repository.Snapshot, target *model.TargetState) ([]string, error) {
	paths := map[string]struct{}{}
	for _, scope := range target.OwnershipScopes {
		mode, exists, err := snapshot.Mode(scope.Path)
		if err != nil {
			return nil, err
		}
		if !exists {
			continue
		}
		if scope.Kind == "file" {
			if !mode.IsRegular() {
				return nil, diagnostic.New("AIDD_OWNED_FILE_TYPE", scope.Path, "target_state", "file ownership scope must be a regular file", "regular file", mode.String())
			}
			paths[scope.Path] = struct{}{}
			continue
		}
		if !mode.IsDir() {
			return nil, diagnostic.New("AIDD_OWNED_TREE_TYPE", scope.Path, "target_state", "tree ownership scope must be a directory", "directory", mode.String())
		}
		files, err := snapshot.RegularFiles(scope.Path)
		if err != nil {
			return nil, err
		}
		for _, path := range files {
			paths[path] = struct{}{}
		}
	}
	result := make([]string, 0, len(paths))
	for path := range paths {
		result = append(result, path)
	}
	sort.Strings(result)
	return result, nil
}

func ValidateFinal(snapshot *repository.Snapshot, target *model.TargetState) ([]string, error) {
	inventory, err := Inventory(snapshot, target)
	if err != nil {
		return nil, err
	}
	expectedSet := map[string]struct{}{}
	for _, representation := range target.Representations {
		expectedSet[representation.Path] = struct{}{}
	}
	expected := make([]string, 0, len(expectedSet))
	for path := range expectedSet {
		expected = append(expected, path)
	}
	sort.Strings(expected)
	if !equal(inventory, expected) {
		return nil, diagnostic.New("AIDD_FINAL_INVENTORY", "representations", "target_state", "owned final-state files must exactly match representation paths", expected, inventory)
	}
	return inventory, nil
}

func BuildManifest(snapshot *repository.Snapshot, target *model.TargetState) (*Manifest, error) {
	inventory, err := ValidateFinal(snapshot, target)
	if err != nil {
		return nil, err
	}
	targetHash, err := canonical.Hash(target)
	if err != nil {
		return nil, err
	}
	manifest := &Manifest{Version: 1, TargetStateSHA256: targetHash}
	for _, path := range inventory {
		content, readErr := snapshot.Read(path)
		if readErr != nil {
			return nil, diagnostic.New("AIDD_FINAL_READ", path, "target_state", "owned file cannot be read", nil, readErr.Error())
		}
		modeValue, exists, statErr := snapshot.Mode(path)
		if statErr != nil {
			return nil, diagnostic.New("AIDD_FINAL_STAT", path, "target_state", "owned file cannot be inspected", nil, statErr.Error())
		}
		if !exists || !modeValue.IsRegular() {
			return nil, diagnostic.New("AIDD_FINAL_STAT", path, "target_state", "owned file must remain a regular file", "regular file", modeValue.String())
		}
		digest := sha256.Sum256(content)
		mode := "100644"
		if modeValue&0o100 != 0 {
			mode = "100755"
		}
		manifest.Files = append(manifest.Files, File{Path: path, Type: "regular", GitMode: mode, SHA256: hex.EncodeToString(digest[:])})
	}
	return manifest, nil
}

func FinalHash(snapshot *repository.Snapshot, target *model.TargetState) (string, error) {
	manifest, err := BuildManifest(snapshot, target)
	if err != nil {
		return "", err
	}
	return canonical.Hash(manifest)
}

func equal(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

package repository

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
)

type MutationEntry struct {
	Path               string `json:"path"`
	Type               string `json:"type"`
	Mode               string `json:"mode"`
	Size               int64  `json:"size"`
	ModTimeUnixNano    int64  `json:"mtime_unix_nano"`
	ChangeTimeUnixNano int64  `json:"ctime_unix_nano"`
	Device             uint64 `json:"device"`
	Inode              uint64 `json:"inode"`
}

type MutationManifest struct {
	Version int             `json:"version"`
	Entries []MutationEntry `json:"entries"`
}

type MutationDifference struct {
	Path     string
	Expected *MutationEntry
	Actual   *MutationEntry
}

// MutationManifestはGit管理対象と未ignoreの新規fileだけを比較する。
// 親directoryの時刻は、正常なignore生成物の書込みでも変わるため含めない。
func (snapshot *Snapshot) MutationManifest(ctx context.Context) (*MutationManifest, error) {
	output, err := snapshot.Git(ctx, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
	if err != nil {
		return nil, err
	}
	paths := strings.Split(string(output), "\x00")
	sort.Strings(paths)
	manifest := &MutationManifest{Version: 1}
	previous := ""
	for _, path := range paths {
		if path == "" || path == previous {
			continue
		}
		previous = path
		if _, err := pathcontract.ValidateRelativePath(path); err != nil {
			return nil, err
		}
		info, err := snapshot.root.Lstat(filepath.FromSlash(path))
		// 削除された管理済みpathはls-filesに残る。前後のinventory差として検出する。
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return nil, diagnostic.New("AIDD_MUTATION_STAT", path, "repository", "verification target cannot be inspected", nil, err.Error())
		}
		item, err := mutationEntry(path, info)
		if err != nil {
			return nil, err
		}
		manifest.Entries = append(manifest.Entries, item)
	}
	return manifest, nil
}

func mutationEntry(path string, info os.FileInfo) (MutationEntry, error) {
	typeName := ""
	switch {
	case info.IsDir():
		typeName = "directory"
	case info.Mode().IsRegular():
		typeName = "regular"
	case info.Mode()&os.ModeSymlink != 0:
		typeName = "symlink"
	default:
		return MutationEntry{}, diagnostic.New("AIDD_MUTATION_TYPE", path, "repository", "verification mutation manifest accepts only directories, regular files, and symbolic links", []string{"directory", "regular", "symlink"}, info.Mode().String())
	}
	device, inode, changeTime, err := platformFileIdentity(info)
	if err != nil {
		return MutationEntry{}, diagnostic.New("AIDD_MUTATION_IDENTITY", path, "repository", "verification mutation identity is unavailable on this platform", "device, inode, and change time", err.Error())
	}
	return MutationEntry{
		Path: path, Type: typeName, Mode: fmt.Sprintf("%04o", info.Mode().Perm()), Size: info.Size(),
		ModTimeUnixNano: info.ModTime().UnixNano(), ChangeTimeUnixNano: changeTime,
		Device: device, Inode: inode,
	}, nil
}

func CompareMutationManifests(expected, actual *MutationManifest) *MutationDifference {
	left := expected.Entries
	right := actual.Entries
	for leftIndex, rightIndex := 0, 0; leftIndex < len(left) || rightIndex < len(right); {
		if leftIndex >= len(left) {
			item := right[rightIndex]
			return &MutationDifference{Path: item.Path, Actual: &item}
		}
		if rightIndex >= len(right) {
			item := left[leftIndex]
			return &MutationDifference{Path: item.Path, Expected: &item}
		}
		if left[leftIndex].Path < right[rightIndex].Path {
			item := left[leftIndex]
			return &MutationDifference{Path: item.Path, Expected: &item}
		}
		if right[rightIndex].Path < left[leftIndex].Path {
			item := right[rightIndex]
			return &MutationDifference{Path: item.Path, Actual: &item}
		}
		if left[leftIndex] != right[rightIndex] {
			expectedItem := left[leftIndex]
			actualItem := right[rightIndex]
			return &MutationDifference{Path: expectedItem.Path, Expected: &expectedItem, Actual: &actualItem}
		}
		leftIndex++
		rightIndex++
	}
	return nil
}

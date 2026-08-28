package repository

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
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

func (snapshot *Snapshot) MutationManifest() (*MutationManifest, error) {
	manifest := &MutationManifest{Version: 1}
	rootInfo, err := snapshot.root.Lstat(".")
	if err != nil {
		return nil, diagnostic.New("AIDD_MUTATION_STAT", ".", "repository", "repository root cannot be inspected for verification mutations", nil, err.Error())
	}
	rootEntry, err := mutationEntry(".", rootInfo)
	if err != nil {
		return nil, err
	}
	manifest.Entries = append(manifest.Entries, rootEntry)

	var visit func(string) error
	visit = func(directory string) error {
		rootPath := directory
		if rootPath == "" {
			rootPath = "."
		}
		handle, openErr := snapshot.root.Open(filepath.FromSlash(rootPath))
		if openErr != nil {
			return diagnostic.New("AIDD_MUTATION_READDIR", rootPath, "repository", "repository directory cannot be opened for verification mutation tracking", nil, openErr.Error())
		}
		entries, readErr := handle.ReadDir(-1)
		closeErr := handle.Close()
		if readErr != nil {
			return diagnostic.New("AIDD_MUTATION_READDIR", rootPath, "repository", "repository directory cannot be read for verification mutation tracking", nil, readErr.Error())
		}
		if closeErr != nil {
			return diagnostic.New("AIDD_MUTATION_READDIR", rootPath, "repository", "repository directory cannot be closed after verification mutation tracking", nil, closeErr.Error())
		}
		sort.Slice(entries, func(left, right int) bool { return entries[left].Name() < entries[right].Name() })
		for _, entry := range entries {
			if entry.Name() == ".git" {
				continue
			}
			path := entry.Name()
			if directory != "" {
				path = directory + "/" + entry.Name()
			}
			if _, pathErr := ValidateRelativePath(path); pathErr != nil {
				return pathErr
			}
			info, statErr := entry.Info()
			if statErr != nil {
				return diagnostic.New("AIDD_MUTATION_STAT", path, "repository", "repository entry changed while the verification mutation manifest was captured", "stable entry", statErr.Error())
			}
			item, identityErr := mutationEntry(path, info)
			if identityErr != nil {
				return identityErr
			}
			manifest.Entries = append(manifest.Entries, item)
			if info.IsDir() {
				if visitErr := visit(path); visitErr != nil {
					return visitErr
				}
			}
		}
		return nil
	}
	if err := visit(""); err != nil {
		return nil, err
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

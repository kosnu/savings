// Package binarycacheはTask開始前のchecker準備と同一性確認を所有する。
package binarycache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

type input struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type identity struct {
	Version     int      `json:"version"`
	Environment []string `json:"environment"`
	Inputs      []input  `json:"inputs"`
}

type manifest struct {
	Identity     identity `json:"identity"`
	Key          string   `json:"key"`
	BinarySHA256 string   `json:"binary_sha256"`
}

func digest(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// Prepareは固定した入力集合に対応する検査済みbinaryの絶対pathを返す。
// 呼出側から契約path、build flags、任意binaryを指定する経路は持たない。
func Prepare(ctx context.Context, root string) (string, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	return prepareChecker(ctx, root, filepath.Join(cache, "aidd-checker", "binaries"))
}

func prepareChecker(ctx context.Context, root, cache string) (string, error) {
	env := buildEnvironment()
	cmd := exec.CommandContext(ctx, "go", "env", "GOVERSION", "GOOS", "GOARCH", "GOAMD64", "GOARM", "GOARM64", "GORISCV64", "GOPPC64", "GOMIPS", "GOMIPS64", "GOEXPERIMENT")
	cmd.Env = env
	cmd.Dir = filepath.Join(root, "tools/aidd/checker")
	version, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("Go environment: %w", err)
	}
	environment := []string{string(version), "CGO_ENABLED=0", "GOFLAGS=", "GOWORK=off", "-trimpath", "-buildvcs=false", "-mod=readonly"}
	return prepare(ctx, root, cache, environment, func(output string) error {
		cmd := exec.CommandContext(ctx, "go", "build", "-trimpath", "-buildvcs=false", "-mod=readonly", "-o", output, "./cmd/aidd-checker")
		cmd.Dir = filepath.Join(root, "tools/aidd/checker")
		cmd.Env = env
		cmd.Stderr = os.Stderr
		return cmd.Run()
	})
}

func buildEnvironment() []string {
	var env []string
	for _, value := range os.Environ() {
		name, _, _ := strings.Cut(value, "=")
		// cacheと取得設定以外のGo build入力はhost既定へ正規化する。
		if strings.HasPrefix(name, "GO") && name != "GOCACHE" && name != "GOMODCACHE" && name != "GOPROXY" && name != "GOSUMDB" && name != "GOPRIVATE" && name != "GONOPROXY" && name != "GONOSUMDB" {
			continue
		}
		if strings.HasPrefix(name, "CGO_") {
			continue
		}
		env = append(env, value)
	}
	return append(env, "GOENV=off", "GOWORK=off", "GOTOOLCHAIN=local", "GOFLAGS=", "CGO_ENABLED=0", "GOOS="+runtime.GOOS, "GOARCH="+runtime.GOARCH)
}

func regular(root, relative string) ([]byte, error) {
	if filepath.IsAbs(relative) || filepath.ToSlash(filepath.Clean(relative)) != relative || relative == "." || relative == ".." || strings.HasPrefix(relative, "../") {
		return nil, fmt.Errorf("invalid input path: %s", relative)
	}
	current := root
	for _, part := range strings.Split(relative, "/") {
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if err != nil {
			return nil, err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("symlink input: %s", relative)
		}
	}
	info, err := os.Stat(current)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("non-regular input: %s", relative)
	}
	return os.ReadFile(current)
}

func capture(root string, environment []string) (identity, string, error) {
	id := identity{Version: 1, Environment: environment}
	paths := map[string]bool{"docs/harness/rule-map.json": true}
	for _, tree := range []string{"tools/aidd/checker", "docs/ai-driven-development/contracts"} {
		err := filepath.WalkDir(filepath.Join(root, tree), func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				return nil
			}
			if !entry.Type().IsRegular() {
				return fmt.Errorf("non-regular build input: %s", path)
			}
			relative, err := filepath.Rel(root, path)
			if err != nil {
				return err
			}
			paths[filepath.ToSlash(relative)] = true
			return nil
		})
		if err != nil {
			return id, "", err
		}
	}
	for _, required := range []string{"tools/aidd/checker/go.mod", "tools/aidd/checker/go.sum", "docs/ai-driven-development/contracts/protocol.json", "docs/ai-driven-development/contracts/verification-profiles.json", "docs/ai-driven-development/contracts/requirements-sections.json"} {
		paths[required] = true
	}
	raw, err := regular(root, "docs/harness/rule-map.json")
	if err != nil {
		return id, "", err
	}
	var routing struct {
		Rules []struct {
			File string `json:"file"`
		} `json:"rules"`
	}
	if err := json.Unmarshal(raw, &routing); err != nil {
		return id, "", err
	}
	if len(routing.Rules) == 0 {
		return id, "", errors.New("rule-map has no rules")
	}
	for _, rule := range routing.Rules {
		paths[rule.File] = true
	}
	sorted := make([]string, 0, len(paths))
	for path := range paths {
		sorted = append(sorted, path)
	}
	sort.Strings(sorted)
	for _, path := range sorted {
		data, err := regular(root, path)
		if err != nil {
			return id, "", err
		}
		id.Inputs = append(id.Inputs, input{Path: path, SHA256: digest(data)})
	}
	raw, err = json.Marshal(id)
	return id, digest(raw), err
}

func inspect(directory, key string) (string, error) {
	info, err := os.Lstat(directory)
	if err != nil {
		return "", err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("invalid cache directory")
	}
	raw, err := regular(directory, "manifest.json")
	if err != nil {
		return "", fmt.Errorf("corrupt cache manifest: %w", err)
	}
	var m manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", fmt.Errorf("corrupt cache manifest: %w", err)
	}
	encoded, err := json.Marshal(m.Identity)
	if err != nil || m.Key != key || digest(encoded) != key {
		return "", errors.New("cache input identity mismatch")
	}
	binary, err := regular(directory, "aidd-checker")
	if err != nil {
		return "", fmt.Errorf("corrupt cached binary: %w", err)
	}
	if digest(binary) != m.BinarySHA256 {
		return "", errors.New("cached binary hash mismatch; refusing execution")
	}
	path := filepath.Join(directory, "aidd-checker")
	info, err = os.Stat(path)
	if err != nil {
		return "", err
	}
	if info.Mode().Perm()&0o111 == 0 {
		return "", errors.New("cached binary is not executable")
	}
	return path, nil
}

func prepare(ctx context.Context, root, cache string, environment []string, build func(string) error) (string, error) {
	id, key, err := capture(root, environment)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(cache, 0o700); err != nil {
		return "", err
	}
	cache, err = filepath.Abs(cache)
	if err != nil {
		return "", err
	}
	directory := filepath.Join(cache, key)
	// entryが存在する場合の欠落・破損をcache missへ変換しない。
	lookup := func() (string, bool, error) {
		_, err := os.Lstat(directory)
		if errors.Is(err, os.ErrNotExist) {
			return "", false, nil
		}
		if err != nil {
			return "", false, err
		}
		path, err := inspect(directory, key)
		return path, true, err
	}
	lock := directory + ".lock"
	deadline := time.NewTimer(30 * time.Second)
	defer deadline.Stop()
	for {
		if path, exists, err := lookup(); exists || err != nil {
			return path, err
		}
		err := os.Mkdir(lock, 0o700)
		if err == nil {
			break
		}
		if !errors.Is(err, os.ErrExist) {
			return "", err
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-deadline.C:
			return "", fmt.Errorf("cache build lock timeout: %s", lock)
		case <-time.After(50 * time.Millisecond):
		}
	}
	defer os.Remove(lock)
	if path, exists, err := lookup(); exists || err != nil {
		return path, err
	}
	temporary, err := os.MkdirTemp(cache, ".prepare-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(temporary)
	output := filepath.Join(temporary, "aidd-checker")
	if err := build(output); err != nil {
		return "", fmt.Errorf("checker build: %w", err)
	}
	_, latest, err := capture(root, environment)
	if err != nil {
		return "", err
	}
	if latest != key {
		return "", errors.New("build inputs changed during preparation")
	}
	binary, err := regular(temporary, "aidd-checker")
	if err != nil {
		return "", err
	}
	if err := os.Chmod(output, 0o500); err != nil {
		return "", err
	}
	raw, err := json.Marshal(manifest{Identity: id, Key: key, BinarySHA256: digest(binary)})
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(temporary, "manifest.json"), raw, 0o400); err != nil {
		return "", err
	}
	if _, err := inspect(temporary, key); err != nil {
		return "", err
	}
	if err := os.Rename(temporary, directory); err != nil {
		return "", err
	}
	return inspect(directory, key)
}

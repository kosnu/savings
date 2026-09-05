package protocol

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/kosnu/savings/tools/aidd/checker/internal/canonical"
	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
	"github.com/kosnu/savings/tools/aidd/checker/internal/pathcontract"
	"github.com/kosnu/savings/tools/aidd/checker/internal/repository"
)

func fail(code, path, message string) error {
	return diagnostic.New("AIDD_VNEXT_"+code, path, "protocol", message, nil, nil)
}

func taskPath(id, suffix string) string { return TaskRoot + "/" + id + "/" + suffix }
func checkpointPath(id string, revision int) string {
	return taskPath(id, fmt.Sprintf("checkpoints/%06d.json", revision))
}
func evidencePath(id, checkpoint string) string { return taskPath(id, "evidence/"+checkpoint+".json") }

func hash(value any) string {
	content, err := canonical.Marshal(value)
	if err != nil {
		panic(err)
	}
	return canonical.HashBytes(content)
}

func checkerIdentity() (string, error) {
	path, err := os.Executable()
	if err != nil {
		return "", err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return canonical.HashBytes(content), nil
}

func write(snapshot *repository.Snapshot, path string, value any, immutable bool) (string, error) {
	exists, err := snapshot.Exists(path)
	if err != nil {
		return "", err
	}
	if immutable && exists {
		return "", fail("IMMUTABLE", path, "既存のtask/checkpointは上書きできません")
	}
	content, err := canonical.Pretty(value)
	if err != nil {
		return "", err
	}
	if err = snapshot.AssertUnchanged(); err != nil {
		return "", err
	}
	if err = snapshot.WriteAtomic(path, content); err != nil {
		return "", err
	}
	return canonical.HashBytes(content), nil
}

func read[T any](snapshot *repository.Snapshot, path string) (T, string, error) {
	return readMode[T](snapshot, path, false)
}

func readMode[T any](snapshot *repository.Snapshot, path string, delivered bool) (T, string, error) {
	var value T
	if err := snapshot.AssertCanonicalOutputMode(path, "protocol"); !delivered && err != nil {
		return value, "", err
	}
	content, err := snapshot.Read(path)
	if err != nil {
		return value, "", err
	}
	if err = canonical.Decode(content, "protocol", &value); err != nil {
		return value, "", err
	}
	expected, err := canonical.Pretty(value)
	if err != nil {
		return value, "", err
	}
	if !bytes.Equal(content, expected) {
		return value, "", fail("CANONICAL", path, "canonical JSONではありません")
	}
	return value, canonical.HashBytes(content), nil
}

func inventory(ctx context.Context, snapshot *repository.Snapshot) ([]File, error) {
	output, err := snapshot.Git(ctx, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
	if err != nil {
		return nil, err
	}
	paths := strings.Split(strings.TrimSuffix(string(output), "\x00"), "\x00")
	sort.Strings(paths)
	result := []File{}
	previous := ""
	for _, path := range paths {
		if path == "" || path == previous {
			continue
		}
		previous = path
		if _, err := pathcontract.ValidateRelativePath(path); err != nil {
			return nil, err
		}
		identity, exists, err := snapshot.ObserveOptionalWorktreeIdentity(path)
		if err != nil {
			return nil, err
		}
		if !exists {
			continue
		}

		result = append(result, File{path, identity.Type, identity.Mode, identity.SHA256})
	}
	return result, nil
}

func fileMap(files []File) map[string]File {
	result := map[string]File{}
	for _, f := range files {
		result[f.Path] = f
	}
	return result
}
func changed(before, after []File) []string {
	old, next := fileMap(before), fileMap(after)
	paths := map[string]bool{}
	for p, f := range old {
		if next[p] != f {
			paths[p] = true
		}
	}
	for p, f := range next {
		if old[p] != f {
			paths[p] = true
		}
	}
	result := []string{}
	for p := range paths {
		result = append(result, p)
	}
	sort.Strings(result)
	return result
}

func withoutGenerated(files []File, id string) []File {
	result := []File{}
	for _, f := range files {
		if !strings.HasPrefix(f.Path, taskPath(id, "")) {
			result = append(result, f)
		}
	}
	return result
}

// Git転送では0600等のローカル権限を保存できないためcontentとGit modeを照合する。
// ローカル実行のartifact mode検査は省略しない。
func transportFiles(files []File, delivered bool) []File {
	result := append([]File{}, files...)
	if !delivered {
		return result
	}
	for i := range result {
		mode, _ := strconv.ParseUint(result[i].Mode, 8, 32)
		if result[i].Type == "symlink" {
			result[i].Mode = "120000"
		} else if mode&0111 != 0 {
			result[i].Mode = "100755"
		} else {
			result[i].Mode = "100644"
		}
	}
	return result
}

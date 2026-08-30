package repository

import (
	"io"
	"os"
	"path/filepath"

	"github.com/kosnu/savings/tools/aidd/checker/internal/diagnostic"
)

func ReadExternal(path string) ([]byte, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, diagnostic.New("AIDD_EXTERNAL_PATH", path, "external_input", "external input path is invalid", "absolute regular non-symlink file", err.Error())
	}
	expected, err := os.Lstat(absolute)
	if err != nil {
		return nil, diagnostic.New("AIDD_EXTERNAL_STAT", path, "external_input", "external input cannot be inspected", "regular non-symlink file", err.Error())
	}
	if !expected.Mode().IsRegular() || expected.Mode()&os.ModeSymlink != 0 {
		return nil, diagnostic.New("AIDD_EXTERNAL_TYPE", path, "external_input", "external input must be a regular non-symlink file", "regular non-symlink file", expected.Mode().String())
	}
	file, err := os.Open(absolute)
	if err != nil {
		return nil, diagnostic.New("AIDD_EXTERNAL_READ", path, "external_input", "external input cannot be opened", "stable regular file", err.Error())
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !os.SameFile(expected, opened) || expected.Mode() != opened.Mode() {
		actual := "path identity changed before read"
		if err != nil {
			actual = err.Error()
		}
		return nil, diagnostic.New("AIDD_EXTERNAL_DRIFT", path, "external_input", "external input changed before it was read", "stable regular file", actual)
	}
	content, err := io.ReadAll(file)
	if err != nil {
		return nil, diagnostic.New("AIDD_EXTERNAL_READ", path, "external_input", "external input cannot be read", "stable regular file", err.Error())
	}
	current, err := os.Lstat(absolute)
	if err != nil || !os.SameFile(expected, current) || expected.Mode() != current.Mode() || expected.Size() != current.Size() || !expected.ModTime().Equal(current.ModTime()) {
		actual := "path identity changed after read"
		if err != nil {
			actual = err.Error()
		}
		return nil, diagnostic.New("AIDD_EXTERNAL_DRIFT", path, "external_input", "external input changed while it was read", "stable regular file", actual)
	}
	return content, nil
}

package core

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

func git(root string, args ...string) ([]byte, error) {
	c := exec.Command("git", append([]string{"-C", root}, args...)...)
	b, e := c.Output()
	if e != nil {
		return nil, fmt.Errorf("git %v: %w", args, e)
	}
	return b, nil
}
func hashBytes(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func (s *Store) own(p string) bool {
	prefix := ".aidd/v4/" + s.Task.ID + "/"
	if p == prefix+"task.json" {
		return true
	}
	if strings.HasPrefix(p, prefix+"events/") {
		name := strings.TrimPrefix(p, prefix+"events/")
		return len(name) == 11 && name[6:] == ".json" && allDigits(name[:6])
	}
	return false
}
func allDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
func (s *Store) snapshot(ref string) (Snapshot, error) {
	out := Snapshot{}
	var b []byte
	var err error
	if ref == "work" {
		b, err = git(s.Root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
		if err != nil {
			return nil, err
		}
		for _, p := range strings.Split(string(b), "\x00") {
			if p == "" || s.own(p) {
				continue
			}
			info, e := os.Lstat(filepath.Join(s.Root, p))
			if os.IsNotExist(e) {
				continue
			}
			if e != nil {
				return nil, e
			}
			mode := "100644"
			var data []byte
			if info.Mode()&os.ModeSymlink != 0 {
				mode = "120000"
				target, e := os.Readlink(filepath.Join(s.Root, p))
				if e != nil {
					return nil, e
				}
				data = []byte(target)
			} else if info.Mode().IsRegular() {
				if info.Mode()&0111 != 0 {
					mode = "100755"
				}
				data, e = os.ReadFile(filepath.Join(s.Root, p))
				if e != nil {
					return nil, e
				}
			} else {
				return nil, fmt.Errorf("unsupported tracked file type: %s", p)
			}
			out[p] = Entry{mode, hashBytes(data)}
		}
		return out, nil
	}
	if ref == "index" {
		b, err = git(s.Root, "ls-files", "--stage", "-z")
	} else {
		b, err = git(s.Root, "ls-tree", "-rz", ref)
	}
	if err != nil {
		return nil, err
	}
	type object struct{ path, mode, oid string }
	objects := []object{}
	for _, line := range strings.Split(string(b), "\x00") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid git entry")
		}
		p := parts[1]
		if s.own(p) {
			continue
		}
		fields := strings.Fields(parts[0])
		mode := fields[0]
		oid := fields[2]
		if ref == "index" {
			oid = fields[1]
			if fields[2] != "0" {
				return nil, fmt.Errorf("unmerged index")
			}
		}
		if mode != "100644" && mode != "100755" && mode != "120000" {
			return nil, fmt.Errorf("unsupported git mode %s", mode)
		}
		objects = append(objects, object{p, mode, oid})
	}
	if len(objects) == 0 {
		return out, nil
	}
	var request strings.Builder
	for _, o := range objects {
		request.WriteString(o.oid + "\n")
	}
	cmd := exec.Command("git", "-C", s.Root, "cat-file", "--batch")
	cmd.Stdin = strings.NewReader(request.String())
	raw, e := cmd.Output()
	if e != nil {
		return nil, e
	}
	reader := bufio.NewReader(bytes.NewReader(raw))
	for _, o := range objects {
		header, e := reader.ReadString('\n')
		if e != nil {
			return nil, e
		}
		f := strings.Fields(header)
		if len(f) != 3 || f[1] != "blob" {
			return nil, fmt.Errorf("invalid git object")
		}
		n, e := strconv.Atoi(f[2])
		if e != nil || n < 0 {
			return nil, fmt.Errorf("invalid object length")
		}
		data := make([]byte, n)
		if _, e = io.ReadFull(reader, data); e != nil {
			return nil, e
		}
		if _, e = reader.ReadByte(); e != nil {
			return nil, e
		}
		out[o.path] = Entry{o.mode, hashBytes(data)}
	}

	return out, nil
}
func changed(a, b Snapshot) []string {
	set := map[string]bool{}
	for p, x := range a {
		if b[p] != x {
			set[p] = true
		}
	}
	for p, x := range b {
		if a[p] != x {
			set[p] = true
		}
	}
	out := []string{}
	for p := range set {
		out = append(out, p)
	}
	sort.Strings(out)
	return out
}
func validPath(p string) bool {
	return p != "" && p != "." && !strings.HasPrefix(p, "/") && !strings.Contains(p, "\\") && filepath.Clean(p) == strings.TrimSuffix(p, "/") && !strings.HasPrefix(p, "../") && !strings.ContainsAny(p, "*?[") && !strings.HasPrefix(p, ".git/") && p != ".git"
}
func covered(p string, paths []string) bool {
	for _, q := range paths {
		if p == q || strings.HasSuffix(q, "/") && strings.HasPrefix(p, q) {
			return true
		}
	}
	return false
}
func (s *Store) current() (Snapshot, string, error) {
	snap, e := s.snapshot("work")
	return snap, digest(snap), e
}
func (s *Store) scope(paths []string, base Snapshot, now Snapshot) error {
	for _, p := range changed(base, now) {
		if !covered(p, paths) {
			return fmt.Errorf("out-of-scope change: %s", p)
		}
	}
	return nil
}

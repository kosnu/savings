package main

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func resolvePreview(ctx context.Context) (string, error) {
	repo := os.Getenv("GITHUB_REPOSITORY")
	pr := os.Getenv("PR_NUMBER")
	token := os.Getenv("GH_TOKEN")
	if !regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`).MatchString(repo) || !regexp.MustCompile(`^[1-9][0-9]*$`).MatchString(pr) || token == "" {
		return "", errors.New("repository・PR番号・read tokenが必要です")
	}
	a := api{base: "https://api.github.com/repos/" + repo}
	r, err := a.request(ctx, "GET", "/pulls/"+pr, token, nil)
	if err != nil {
		return "", err
	}
	var pull struct {
		State string
		Head  struct {
			SHA  string
			Repo struct {
				FullName string `json:"full_name"`
			}
		}
		Base struct{ Ref string }
	}
	if err = r.decode(&pull); err != nil {
		return "", err
	}
	if os.Getenv("EXPECTED_HEAD") != pull.Head.SHA {
		return "", errors.New("承認対象のPR headが変わりました")
	}
	if pull.State != "open" || pull.Head.Repo.FullName != repo || pull.Base.Ref != "main" || !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(pull.Head.SHA) {
		return "", errors.New("同一repositoryのmain宛open PRが必要です")
	}
	r, err = a.request(ctx, "GET", "/commits/"+pull.Head.SHA+"/status?per_page=100", token, nil)
	if err != nil {
		return "", err
	}
	var result struct {
		Statuses []struct {
			Context, State string
			URL            string `json:"target_url"`
		}
	}
	if err = r.decode(&result); err != nil {
		return "", err
	}
	for _, s := range result.Statuses {
		if s.Context == "Dev Preview URL / PR #"+pr {
			if s.State != "success" {
				break
			}
			if err = validatePreview(s.URL); err != nil {
				return "", err
			}
			return s.URL, nil
		}
	}
	return "", errors.New("現在のPR headに対応するDev配信成功がありません")
}

// PRのSQLとconfigだけをデータとして取得し、Hosted資格情報を候補コードへ渡さない。
func downloadCandidate(ctx context.Context) (string, error) {
	sha := os.Getenv("EXPECTED_HEAD")
	if !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(sha) {
		return "", errors.New("完全な対象SHAが必要です")
	}
	a := api{base: "https://api.github.com/repos/" + os.Getenv("GITHUB_REPOSITORY")}
	r, err := a.request(ctx, "GET", "/git/trees/"+sha+"?recursive=1", os.Getenv("GH_TOKEN"), nil)
	if err != nil {
		return "", err
	}
	var tree struct {
		Truncated bool
		Tree      []struct{ Path, Mode, Type, SHA string }
	}
	if err = r.decode(&tree); err != nil {
		return "", err
	}
	if tree.Truncated {
		return "", errors.New("PR treeを完全取得できません")
	}
	temp, err := os.MkdirTemp("", "savings-ci-candidate-")
	if err != nil {
		return "", err
	}
	ok := false
	defer func() {
		if !ok {
			os.RemoveAll(temp)
		}
	}()
	counts := map[string]int{"migrations": 0, "tests": 0, "config": 0}
	for _, entry := range tree.Tree {
		kind, rel := "", ""
		if entry.Path == "apps/api/supabase/config.toml" {
			kind, rel = "config", "config.toml"
		} else {
			for _, name := range []string{"migrations", "tests"} {
				prefix := "apps/api/supabase/" + name + "/"
				if strings.HasPrefix(entry.Path, prefix) && strings.HasSuffix(entry.Path, ".sql") {
					kind, rel = name, strings.TrimPrefix(entry.Path, prefix)
					break
				}
			}
		}
		if kind == "" {
			continue
		}
		if entry.Type != "blob" || entry.Mode != "100644" || strings.Contains(rel, "/") || rel == "" {
			return "", errors.New("候補データのpath/modeが不正です")
		}
		if !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(entry.SHA) {
			return "", errors.New("blob SHAが不正です")
		}
		blob, e := a.request(ctx, "GET", "/git/blobs/"+entry.SHA, os.Getenv("GH_TOKEN"), nil)
		if e != nil {
			return "", e
		}
		var body struct{ Encoding, Content string }
		if e = blob.decode(&body); e != nil {
			return "", e
		}
		if body.Encoding != "base64" {
			return "", errors.New("候補データblobの形式が不正です")
		}
		data, e := base64.StdEncoding.DecodeString(strings.ReplaceAll(body.Content, "\n", ""))
		if e != nil {
			return "", e
		}
		dir := filepath.Join(temp, "apps/api/supabase")
		if kind != "config" {
			dir = filepath.Join(dir, kind)
		}
		if e = os.MkdirAll(dir, 0700); e != nil {
			return "", e
		}
		if e = os.WriteFile(filepath.Join(dir, rel), data, 0600); e != nil {
			return "", e
		}
		counts[kind]++
	}
	if counts["migrations"] == 0 || counts["tests"] == 0 || counts["config"] != 1 {
		return "", errors.New("候補のconfig・migration・DB試験が揃っていません")
	}
	ok = true
	return temp, nil
}

package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var secretPattern = regexp.MustCompile(`sb_secret_[A-Za-z0-9_-]+|sbp_[A-Za-z0-9]{20,}|GOCSPX-[A-Za-z0-9_-]+`)
var jwtPattern = regexp.MustCompile(`eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`)
var sourceMapPattern = regexp.MustCompile(`sourceMappingURL=([^\s*]+)`)
var assetPattern = regexp.MustCompile(`["']([^"'\s<>]+\.(?:js|css|map)(?:\?[^"'\s<>]*)?)["']`)

func secretValues() []string {
	var result []string
	for _, key := range []string{"SUPABASE_ACCESS_TOKEN", "SUPABASE_GOOGLE_CLIENT_SECRET", "SENTRY_AUTH_TOKEN"} {
		if v := os.Getenv(key); len(v) >= 8 {
			result = append(result, v)
		}
	}
	return result
}
func scanContent(data []byte, known []string) error {
	if secretPattern.Match(data) {
		return errors.New("管理用の秘密情報を検出（値は非表示）")
	}
	for _, token := range jwtPattern.FindAll(data, -1) {
		parts := strings.Split(string(token), ".")
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			continue
		}
		var claims map[string]any
		if json.Unmarshal(payload, &claims) == nil && claims["role"] == "service_role" {
			return errors.New("service_role JWTを検出（値は非表示）")
		}
	}
	for _, v := range known {
		if strings.Contains(string(data), v) {
			return errors.New("非公開環境変数の値を検出（値は非表示）")
		}
	}
	return nil
}
func scanDirectory(dir string, known []string) error {
	count := 0
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			return errors.New("配信物のsymlinkは検査できません")
		}
		ext := filepath.Ext(path)
		if ext != ".js" && ext != ".html" && ext != ".map" && ext != ".css" {
			return nil
		}
		data, e := os.ReadFile(path)
		if e != nil {
			return e
		}
		count++
		return scanContent(data, known)
	})
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New("検査対象の配信物がありません")
	}
	fmt.Printf("PASS ビルド配信物 %d件\n", count)
	return nil
}
func validatePreview(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || u.RawQuery != "" || u.Fragment != "" || u.Path != "" && u.Path != "/" {
		return errors.New("Dev Previewのoriginが必要です")
	}
	if !regexp.MustCompile(`^pr-[1-9][0-9]*-burneto-dev\.[a-z0-9-]+\.workers\.dev$`).MatchString(u.Hostname()) {
		return errors.New("Dev Preview以外は検査しません")
	}
	return nil
}
func scanRemote(ctx context.Context, raw string, known []string) error {
	if err := validatePreview(raw); err != nil {
		return err
	}
	root, _ := url.Parse(strings.TrimRight(raw, "/") + "/")
	queue := []string{root.String()}
	seen := map[string]bool{}
	scripts := 0
	for len(queue) > 0 {
		target := queue[0]
		queue = queue[1:]
		if seen[target] {
			continue
		}
		seen[target] = true
		if len(seen) > 2048 {
			return errors.New("配信物の探索上限に達しました")
		}
		req, err := http.NewRequestWithContext(ctx, "GET", target, nil)
		if err != nil {
			return err
		}
		resp, err := client.Do(req)
		if err != nil {
			return errors.New("Dev配信物の取得失敗")
		}
		data, e := io.ReadAll(io.LimitReader(resp.Body, (16<<20)+1))
		resp.Body.Close()
		if e != nil {
			return e
		}
		if len(data) > 16<<20 {
			return errors.New("配信物が検査上限を超えています")
		}
		if resp.StatusCode != 200 {
			return fmt.Errorf("Dev配信物のHTTP %d", resp.StatusCode)
		}
		if err = scanContent(data, known); err != nil {
			return err
		}
		current, _ := url.Parse(target)
		if strings.HasSuffix(current.Path, ".js") {
			if strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/html") {
				return errors.New("JSの代わりにHTMLが返りました")
			}
			scripts++
		}
		references := assetPattern.FindAllSubmatch(data, -1)
		references = append(references, sourceMapPattern.FindAllSubmatch(data, -1)...)
		for _, m := range references {
			relative, e := url.Parse(string(m[1]))
			if e != nil {
				return e
			}
			resolved := current.ResolveReference(relative)
			if resolved.Host != root.Host || resolved.Scheme != "https" {
				continue
			}
			resolved.Fragment = ""
			queue = append(queue, resolved.String())
		}
	}
	if scripts == 0 {
		return errors.New("DevでJavaScriptを取得できませんでした")
	}
	return nil
}

func redact(value string) string {
	value = secretPattern.ReplaceAllString(value, "[redacted]")
	value = jwtPattern.ReplaceAllString(value, "[redacted]")
	for _, secret := range secretValues() {
		value = strings.ReplaceAll(value, secret, "[redacted]")
	}
	if len(value) > 2000 {
		value = value[len(value)-2000:]
	}
	return value
}

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const localProject = "savings-security-ci"
const localConfig = `project_id = "savings-security-ci"
[api]
port = 56321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = 56322
shadow_port = 56320
major_version = 17
[db.seed]
enabled = false
[auth]
site_url = "http://127.0.0.1:56300"
enable_signup = true
[auth.email]
enable_signup = true
enable_confirmations = false
[studio]
enabled = false
[analytics]
enabled = false
[storage]
enabled = false
[realtime]
enabled = false
[edge_runtime]
enabled = false
`

func command(ctx context.Context, dir, input, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	cmd.Stdin = strings.NewReader(input)
	// CI内のプロセスにはHostedの資格情報を渡さない。
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "SUPABASE_") && !strings.HasPrefix(e, "GH_TOKEN=") && !strings.HasPrefix(e, "SENTRY_AUTH_TOKEN=") {
			cmd.Env = append(cmd.Env, e)
		}
	}
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%s の実行失敗: %w: %s", name, err, redact(out.String()+"\n"+stderr.String()))
	}
	return out.Bytes(), nil
}

func local(ctx context.Context, root string) error { return localRun(ctx, root, nil) }

func localRun(ctx context.Context, root string, extra func(context.Context) error) (err error) {
	temp, err := os.MkdirTemp("", "savings-security-ci-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	if err = os.Mkdir(filepath.Join(temp, "supabase"), 0700); err != nil {
		return err
	}
	if err = os.WriteFile(filepath.Join(temp, "supabase/config.toml"), []byte(localConfig), 0600); err != nil {
		return err
	}
	for _, name := range []string{"migrations", "tests"} {
		src := filepath.Join(root, "apps/api/supabase", name)
		err = filepath.WalkDir(src, func(p string, d fs.DirEntry, e error) error {
			if e != nil {
				return e
			}
			rel, e := filepath.Rel(src, p)
			if e != nil {
				return e
			}
			dest := filepath.Join(temp, "supabase", name, rel)
			if d.IsDir() {
				return os.MkdirAll(dest, 0700)
			}
			if d.Type()&os.ModeSymlink != 0 {
				return errors.New("fixtureにsymlinkは使えません")
			}
			data, e := os.ReadFile(p)
			if e != nil {
				return e
			}
			return os.WriteFile(dest, data, 0600)
		})
		if err != nil {
			return err
		}
	}
	// 既存のローカルDBを再利用・resetしない。
	if _, e := command(ctx, root, "", "docker", "inspect", "supabase_db_"+localProject); e == nil {
		return errors.New("検証専用containerが既に存在します。先行実行を確認してください")
	}
	defer func() {
		clean, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		_, e := command(clean, root, "", "supabase", "stop", "--workdir", temp, "--no-backup")
		err = errors.Join(err, e)
	}()
	fmt.Println("START 隔離Supabase・migration適用")
	if _, err = command(ctx, root, "", "supabase", "start", "--workdir", temp, "--exclude", "studio,postgres-meta,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor"); err != nil {
		return err
	}
	fmt.Println("PASS 隔離Supabase・migration適用")
	testPaths, err := filepath.Glob(filepath.Join(temp, "supabase/tests/*.sql"))
	if err != nil || len(testPaths) == 0 {
		return errors.New("DB試験ファイルがありません")
	}
	count := 0
	for _, path := range testPaths {
		query, e := os.ReadFile(path)
		if e != nil {
			return e
		}
		result, e := sql(ctx, string(query))
		if e != nil {
			return fmt.Errorf("%s: %w", filepath.Base(path), e)
		}
		n, e := checkTAP(string(result))
		if e != nil {
			return fmt.Errorf("%s: %w", filepath.Base(path), e)
		}
		count += n
	}
	fmt.Printf("PASS pgTAP %d件\n", count)
	fmt.Println("PASS 既存DB境界・予算履歴・timezoneテスト")
	state, err := sql(ctx, schemaStateSQL)
	if err != nil {
		return err
	}
	var parsed any
	if err = json.Unmarshal(state, &parsed); err != nil {
		return err
	}
	if extra != nil {
		return extra(ctx)
	}

	data, err := command(ctx, root, "", "supabase", "status", "--workdir", temp, "-o", "json")
	if err != nil {
		return err
	}
	var status map[string]string
	if err = json.Unmarshal(data, &status); err != nil {
		return err
	}
	if status["API_URL"] != "http://127.0.0.1:56321" {
		return errors.New("隔離API URLが一致しません")
	}
	if status["ANON_KEY"] == "" || status["SERVICE_ROLE_KEY"] == "" {
		return errors.New("隔離APIキーを取得できません")
	}
	a := api{status["API_URL"], status["ANON_KEY"]}
	if err = apiChecks(ctx, a, status["SERVICE_ROLE_KEY"]); err != nil {
		return err
	}
	fmt.Println("PASS APIデータ分離・列権限・RPC・セッション更新・CRUD")
	return nil
}

func sql(ctx context.Context, query string) ([]byte, error) {
	return command(ctx, "", query, "docker", "exec", "-i", "supabase_db_"+localProject, "psql", "-XAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1")
}

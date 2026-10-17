package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPermissionFailureIsNotAnyHTTPFailure(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
		ok     bool
	}{
		{200, "[]", true}, {403, `{"code":"42501"}`, true}, {401, `{"code":"PGRST301"}`, false},
		{400, `{"code":"22P02"}`, false}, {404, `{}`, false}, {500, `{}`, false}, {200, `[{"id":1}]`, false},
	} {
		err := denied(response{status: tc.status, body: []byte(tc.body)})
		if (err == nil) != tc.ok {
			t.Errorf("%d %s: %v", tc.status, tc.body, err)
		}
	}
}
func TestSecretScannerAndRedaction(t *testing.T) {
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"role":"service_role"}`))
	tokens := []string{"sb_secret_abcdefghijklmnop", "sbp_abcdefghijklmnopqrstuvwxyz", "GOCSPX-abcdefghijklmnop", "eyJhbGciOiJIUzI1NiJ9." + payload + ".signature", "known-secret-value"}
	for _, token := range tokens {
		if scanContent([]byte("x="+token), []string{"known-secret-value"}) == nil {
			t.Errorf("secret not detected")
		}
	}
	if err := scanContent([]byte("sb_publishable_abc"), nil); err != nil {
		t.Fatal(err)
	}
	payload = base64.RawURLEncoding.EncodeToString([]byte(`{"role":"anon"}`))
	if err := scanContent([]byte("eyJhbGciOiJIUzI1NiJ9."+payload+".signature"), nil); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(redact(tokens[0]), tokens[0]) {
		t.Fatal("secret leaked")
	}
}
func TestPreviewRejectsProductionAndCredentialURLs(t *testing.T) {
	for _, raw := range []string{"https://burneto.com", "http://pr-1-burneto-dev.foo.workers.dev", "https://pr-1-burneto-dev.foo.workers.dev.evil.test", "https://user:pass@pr-1-burneto-dev.foo.workers.dev", "https://pr-1-burneto-dev.foo.workers.dev:443", "https://pr-1-burneto-dev.foo.workers.dev/path"} {
		if validatePreview(raw) == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	if err := validatePreview("https://pr-1951-burneto-dev.account.workers.dev"); err != nil {
		t.Fatal(err)
	}
}
func TestExpectedConfigMustExistAndArraysMustMatch(t *testing.T) {
	if validateExpectations(expectations{}) == nil {
		t.Fatal("missing config passed")
	}
	for _, tc := range []struct {
		actual, want string
		ok           bool
	}{
		{`{"enabled":true,"secret":"private"}`, `{"enabled":true}`, true},
		{`{"enabled":false}`, `{"enabled":true}`, false},
		{`{}`, `{"enabled":null}`, false},
		{`["unexpected"]`, `[]`, false},
	} {
		var a, w any
		_ = json.Unmarshal([]byte(tc.actual), &a)
		_ = json.Unmarshal([]byte(tc.want), &w)
		if containsJSON(a, w) != tc.ok {
			t.Error(tc)
		}
	}
}
func TestDevSettingsRequireOnlyDocumentedExpectations(t *testing.T) {
	base := `{"auth":{"external_google_enabled":true,"site_url":"https://pr-1951-burneto-dev.account.workers.dev","uri_allow_list":"https://pr-1951-burneto-dev.account.workers.dev/auth"},"postgrest":{"db_schema":"public"}}`
	for _, tc := range []struct {
		name, settings string
		ok             bool
	}{
		{"documented-only", base, true},
		{"optional-ssl", strings.TrimSuffix(base, "}") + `,"ssl":{"enforced":true}}`, true},
		{"optional-empty-functions", strings.TrimSuffix(base, "}") + `,"functions":[]}`, true},
		{"google-disabled", strings.Replace(base, `"external_google_enabled":true`, `"external_google_enabled":false`, 1), false},
		{"redirect-missing", strings.Replace(base, `"uri_allow_list":"https://pr-1951-burneto-dev.account.workers.dev/auth"`, `"uri_allow_list":null`, 1), false},
		{"public-missing", strings.Replace(base, `"db_schema":"public"`, `"db_schema":"private"`, 1), false},
		{"no-auth", `{"postgrest":{"db_schema":"public"}}`, false},
		{"no-postgrest", `{"auth":{"external_google_enabled":true}}`, false},
		{"unknown-section", strings.TrimSuffix(base, "}") + `,"typo":{"enabled":true}}`, false},
		{"empty-optional", strings.TrimSuffix(base, "}") + `,"ssl":{}}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := expectations{PreviewURL: "https://pr-1951-burneto-dev.account.workers.dev"}
			if err := json.Unmarshal([]byte(tc.settings), &e.Settings); err != nil {
				t.Fatal(err)
			}
			if err := validateExpectations(e); (err == nil) != tc.ok {
				t.Fatalf("validation: %v", err)
			}
		})
	}
}

func TestDevSettingsCallOnlySelectedEndpoints(t *testing.T) {
	original := client
	defer func() { client = original }()
	for _, tc := range []struct {
		name, body string
		status     int
		optional   bool
		ok         bool
	}{
		{"minimal", `{"external_google_enabled":true}`, 200, false, true},
		{"mismatch", `{"external_google_enabled":false}`, 200, false, false},
		{"unavailable", `{}`, 403, false, false},
		{"selected-ssl", `{"external_google_enabled":true}`, 200, true, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			seen := map[string]bool{}
			client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				seen[r.URL.Path] = true
				body, status := tc.body, tc.status
				switch r.URL.Path {
				case "/postgrest":
					body, status = `{"db_schema":"public"}`, 200
				case "/ssl-enforcement":
					body, status = `{"enforced":true}`, 200
				case "/config/auth":
				default:
					t.Fatalf("unselected endpoint called: %s", r.URL.Path)
				}
				return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body))}, nil
			})}
			e := expectations{Settings: map[string]json.RawMessage{
				"auth":      json.RawMessage(`{"external_google_enabled":true}`),
				"postgrest": json.RawMessage(`{"db_schema":"public"}`),
			}}
			if tc.optional {
				e.Settings["ssl"] = json.RawMessage(`{"enforced":true}`)
			}
			err := checkDevSettings(context.Background(), api{base: "https://example.test"}, "token", e)
			if (err == nil) != tc.ok {
				t.Fatalf("check: %v", err)
			}
			if tc.ok && seen["/ssl-enforcement"] != tc.optional {
				t.Fatal("optional endpoint selection")
			}
		})
	}
}

func TestAssetsFailOnEmptyAndNestedLeak(t *testing.T) {
	dir := t.TempDir()
	if scanDirectory(dir, nil) == nil {
		t.Fatal("empty passed")
	}
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "lazy.js"), []byte(`const secret="GOCSPX-secret"`), 0600); err != nil {
		t.Fatal(err)
	}
	if scanDirectory(dir, nil) == nil {
		t.Fatal("nested leak passed")
	}
}
func TestAPIAuthHeaderAndNoRedirect(t *testing.T) {
	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { got = r.Header.Get("Authorization"); w.WriteHeader(302) }))
	defer server.Close()
	a := api{server.URL, "public"}
	r, err := a.request(context.Background(), "GET", "/", "user", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != "Bearer user" || r.status != 302 {
		t.Fatal("header or redirect behavior")
	}
	_, err = a.request(context.Background(), "GET", "/", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Fatal("anonymous inherited token")
	}
}
func TestDevGuardBeforeNetwork(t *testing.T) {
	t.Setenv("GITHUB_ACTIONS", "true")
	t.Setenv("GITHUB_REF", "refs/heads/untrusted")
	if err := dev(context.Background(), t.TempDir()); err == nil {
		t.Fatal("untrusted ref accepted")
	}
	t.Setenv("GITHUB_REF", "refs/heads/main")
	t.Setenv("SUPABASE_PROJECT_ID", "production")
	if err := dev(context.Background(), t.TempDir()); err == nil {
		t.Fatal("production accepted")
	}
}

func TestTAPRequiresAllAssertionsAndPositivePlan(t *testing.T) {
	for _, output := range []string{"", "1..0\n", "1..2\nok 1\n", "1..1\nnot ok 1\n", "1..1\nok 1 # SKIP\n", "1..1\nok 2\n", "Bail out!\n", "1..1\nok 1\n1..1\n"} {
		if _, err := checkTAP(output); err == nil {
			t.Errorf("accepted incomplete TAP %q", output)
		}
	}
	for _, output := range []string{"1..2\nok 1 - a\nok 2 - b\n", "BEGIN\nok 1\nok 2\n1..2\nROLLBACK\n"} {
		if n, err := checkTAP(output); err != nil || n != 2 {
			t.Errorf("%d %v", n, err)
		}
	}
}

func TestWorkflowUsesGoEntrypointsWithoutInlineScripts(t *testing.T) {
	root := filepath.Join("..", "..")
	data, err := os.ReadFile(filepath.Join(root, ".github/workflows/supabase_ci.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	if strings.Contains(text, "run: |") || strings.Contains(text, "script:") {
		t.Fatal("inline workflow script")
	}
	for _, line := range strings.Split(text, "\n") {
		if strings.Contains(line, "run:") && !strings.Contains(line, "run: go -C tools/supabase-check ") {
			t.Fatalf("non-Go step: %s", line)
		}
	}
	for _, required := range []string{"persist-credentials: false", "environment: development", "github.ref == 'refs/heads/main'", "burneto-shared-dev-database", "version: 2.120.0"} {
		if !strings.Contains(text, required) {
			t.Fatalf("missing %s", required)
		}
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestRemoteAssetsFollowLazyImportsAndRejectFallback(t *testing.T) {
	original := client
	defer func() { client = original }()
	for _, mode := range []string{"clean", "leak", "fallback", "map"} {
		seen := map[string]bool{}
		client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			seen[r.URL.Path] = true
			body := `<script src="/assets/main.js"></script>`
			mime := "text/html"
			switch r.URL.Path {
			case "/assets/main.js":
				body = `import("./lazy.js")`
				mime = "application/javascript"
			case "/assets/lazy.js":
				body = `export const x=1`
				mime = "application/javascript"
				if mode == "leak" {
					body = `const secret="sb_secret_secret"`
				}
				if mode == "fallback" {
					mime = "text/html"
				}
				if mode == "map" {
					body += "\n//# sourceMappingURL=lazy.js.map"
				}
			case "/assets/lazy.js.map":
				body = `{"sourcesContent":["GOCSPX-private"]}`
				mime = "application/json"
			}
			return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{mime}}, Body: io.NopCloser(strings.NewReader(body))}, nil
		})}
		err := scanRemote(context.Background(), "https://pr-1951-burneto-dev.account.workers.dev", nil)
		if mode == "clean" && err != nil {
			t.Fatal(err)
		}
		if mode != "clean" && err == nil {
			t.Fatalf("%s passed", mode)
		}
		if !seen["/assets/lazy.js"] {
			t.Fatal("lazy assets were not scanned")
		}
	}
}

func TestCandidateConfigContractBeforeIsolation(t *testing.T) {
	baseline, err := os.ReadFile("../../apps/api/supabase/config.toml")
	if err != nil {
		t.Fatal(err)
	}
	good := string(baseline)
	for _, tc := range []struct {
		name, config string
		ok           bool
	}{
		{"existing", good, true},
		{"equivalent-toml", strings.ReplaceAll(good, `"`, `'`), true},
		{"google-disabled", strings.Replace(good, "enabled = true", "enabled = false", 1), false},
		{"google-missing", strings.Replace(good, "enabled = true", "", 1), false},
		{"redirect-variable", strings.ReplaceAll(good, "AUTH_REDIRECT_URL", "AUTH_REDIRECT_TYPO"), false},
		{"site-variable", strings.ReplaceAll(good, "AUTH_SITE_URL", "AUTH_SITE_TYPO"), false},
		{"client-variable", strings.ReplaceAll(good, "SUPABASE_GOOGLE_CLIENT_ID", "CLIENT_TYPO"), false},
		{"secret-variable", strings.ReplaceAll(good, "SUPABASE_GOOGLE_CLIENT_SECRET", "SECRET_TYPO"), false},
		{"callback-variable", strings.ReplaceAll(good, "SUPABASE_GOOGLE_REDIRECT_URL", "CALLBACK_TYPO"), false},
		{"nonce-variable", strings.ReplaceAll(good, "SUPABASE_GOOGLE_SKIP_NONCE_CHECK", "NONCE_TYPO"), false},
		{"literal-secret", strings.ReplaceAll(good, "env(SUPABASE_GOOGLE_CLIENT_SECRET)", "GOCSPX-private-value"), false},
		{"invalid-toml", good + "\n[auth\nsecret = 'GOCSPX-private-value'", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			dir := filepath.Join(root, "apps/api/supabase")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(tc.config), 0600); err != nil {
				t.Fatal(err)
			}
			err := checkCandidateConfig(root)
			if (err == nil) != tc.ok {
				t.Fatalf("config validation: %v", err)
			}
			if !tc.ok {
				// 実際の入口も、Dockerやmigrationの準備より前に拒否する。
				err = localRun(context.Background(), root, nil)
				if err == nil || !strings.Contains(err.Error(), "config.toml") {
					t.Fatalf("entrypoint bypassed config: %v", err)
				}
				if strings.Contains(err.Error(), "GOCSPX-private-value") {
					t.Fatal("config error leaked a value")
				}
			}
		})
	}
	for _, service := range []string{"analytics", "storage", "edge_runtime", "local_smtp", "realtime"} {
		t.Run(service, func(t *testing.T) {
			root := t.TempDir()
			dir := filepath.Join(root, "apps/api/supabase")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			config := strings.Replace(good, "["+service+"]\nenabled = false", "["+service+"]\nenabled = true", 1)
			if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(config), 0600); err != nil {
				t.Fatal(err)
			}
			if err := checkCandidateConfig(root); err == nil {
				t.Fatal("enabled unused service passed")
			}
		})
	}
	if err := checkCandidateConfig(t.TempDir()); err == nil {
		t.Fatal("missing config passed")
	}
}

func TestDownloadCandidateIncludesConfigAsData(t *testing.T) {
	baseline, err := os.ReadFile("../../apps/api/supabase/config.toml")
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("GITHUB_REPOSITORY", "kosnu/savings")
	t.Setenv("EXPECTED_HEAD", strings.Repeat("a", 40))
	t.Setenv("GH_TOKEN", "test-token")
	original := client
	defer func() { client = original }()
	for _, mode := range []string{"normal", "bad-config", "missing-config", "symlink-config"} {
		t.Run(mode, func(t *testing.T) {
			config := string(baseline)
			if mode == "bad-config" {
				config = strings.Replace(config, "enabled = true", "enabled = false", 1)
			}
			blobs := map[string]string{"b": config, "c": "select 1;", "d": "select 1;"}
			seenConfig := false
			client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				var result any
				if strings.Contains(r.URL.Path, "/git/trees/") {
					tree := []map[string]string{
						{"path": "apps/api/supabase/migrations/20260101000000_test.sql", "mode": "100644", "type": "blob", "sha": strings.Repeat("c", 40)},
						{"path": "apps/api/supabase/tests/test.sql", "mode": "100644", "type": "blob", "sha": strings.Repeat("d", 40)},
						{"path": "tools/supabase-check/local.go", "mode": "100644", "type": "blob", "sha": strings.Repeat("e", 40)},
					}
					if mode != "missing-config" {
						fileMode := "100644"
						if mode == "symlink-config" {
							fileMode = "120000"
						}
						tree = append(tree, map[string]string{"path": "apps/api/supabase/config.toml", "mode": fileMode, "type": "blob", "sha": strings.Repeat("b", 40)})
					}
					result = map[string]any{"tree": tree}
				} else {
					key := r.URL.Path[len(r.URL.Path)-40:][:1]
					body, ok := blobs[key]
					if !ok {
						t.Fatalf("downloaded candidate code: %s", r.URL.Path)
					}
					if key == "b" {
						seenConfig = true
					}
					result = map[string]any{"encoding": "base64", "content": base64.StdEncoding.EncodeToString([]byte(body))}
				}
				data, err := json.Marshal(result)
				if err != nil {
					t.Fatal(err)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
			})}
			root, err := downloadCandidate(context.Background())
			if mode == "missing-config" || mode == "symlink-config" {
				if err == nil {
					os.RemoveAll(root)
					t.Fatal("invalid config tree passed")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(root)
			if !seenConfig {
				t.Fatal("candidate config was not fetched")
			}
			err = checkCandidateConfig(root)
			if (err == nil) != (mode == "normal") {
				t.Fatalf("downloaded config validation: %v", err)
			}
		})
	}
}

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

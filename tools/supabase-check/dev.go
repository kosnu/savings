package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"
)

const devRef = "ufekmuxkmodwydxmdbln"

var configEndpoints = map[string]string{
	"auth": "/config/auth", "postgrest": "/postgrest", "ssl": "/ssl-enforcement",
	"network": "/network-restrictions", "storage": "/config/storage", "realtime": "/config/realtime",
	"functions": "/functions", "pooler": "/config/database/pooler",
}

type expectations struct {
	PreviewURL string                     `json:"preview_url"`
	Settings   map[string]json.RawMessage `json:"settings"`
}

func dev(ctx context.Context, root string) error {
	if os.Getenv("GITHUB_ACTIONS") == "true" && os.Getenv("GITHUB_REF") != "refs/heads/main" {
		return errors.New("Dev確認はmainの承認済みworkflowだけで実行します")
	}
	if os.Getenv("SUPABASE_PROJECT_ID") != devRef {
		return errors.New("Dev project refが一致しません")
	}
	token := os.Getenv("SUPABASE_ACCESS_TOKEN")
	if token == "" {
		return errors.New("Dev専用の読み取りtokenが必要です")
	}
	var expected expectations
	if err := json.Unmarshal([]byte(os.Getenv("SUPABASE_DEV_EXPECTATIONS")), &expected); err != nil {
		return errors.New("SUPABASE_DEV_EXPECTATIONSに採用済み期待値が必要です")
	}
	preview, err := resolvePreview(ctx)
	if err != nil {
		return err
	}
	expected.PreviewURL = preview
	if err := validateExpectations(expected); err != nil {
		return err
	}
	a := api{base: "https://api.supabase.com/v1/projects/" + devRef}
	for _, name := range sortedKeys(configEndpoints) {
		r, err := a.request(ctx, "GET", configEndpoints[name], token, nil)
		if err != nil {
			return err
		}
		var actual any
		if err = r.decode(&actual); err != nil {
			return fmt.Errorf("Dev %s取得不能（未確認）: %w", name, err)
		}
		var want any
		if err = json.Unmarshal(expected.Settings[name], &want); err != nil {
			return err
		}
		if !containsJSON(actual, want) {
			return fmt.Errorf("Dev %sが期待値と一致しません（値は非表示）", name)
		}
		fmt.Printf("PASS Dev %s設定\n", name)
	}
	// 公開API自体の可用性は未認証のルート要求で確認する。
	key := os.Getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
	if key == "" {
		return errors.New("Dev公開用キーが必要です")
	}
	rest := api{"https://" + devRef + ".supabase.co", key}
	r, err := rest.request(ctx, "GET", "/rest/v1/", "", nil)
	if err != nil {
		return err
	}
	if err = allowed(r); err != nil {
		return err
	}
	if err = scanRemote(ctx, expected.PreviewURL, secretValues()); err != nil {
		return err
	}
	fmt.Println("PASS Dev公開API・実配信物")
	candidate, err := downloadCandidate(ctx)
	if err != nil {
		return err
	}
	defer os.RemoveAll(candidate)
	if err = localRun(ctx, candidate, func(ctx context.Context) error { return compareDevSchema(ctx, a, token) }); err != nil {
		return err
	}
	current, err := resolvePreview(ctx)
	if err != nil {
		return err
	}
	if current != preview {
		return errors.New("確認中にDev配信が変わりました")
	}
	return nil
}
func validateExpectations(e expectations) error {
	if err := validatePreview(e.PreviewURL); err != nil {
		return err
	}
	if len(e.Settings) != len(configEndpoints) {
		return errors.New("全設定項目の期待値が必要です")
	}
	for name := range configEndpoints {
		raw, ok := e.Settings[name]
		if !ok {
			return fmt.Errorf("%sの期待値がありません", name)
		}
		var v any
		if json.Unmarshal(raw, &v) != nil || v == nil {
			return fmt.Errorf("%sの期待値が不正です", name)
		}
		if m, ok := v.(map[string]any); ok && len(m) == 0 {
			return fmt.Errorf("%sの期待値が空です", name)
		}
	}
	var auth map[string]any
	_ = json.Unmarshal(e.Settings["auth"], &auth)
	for _, k := range []string{"external_google_enabled", "external_google_client_id", "site_url", "uri_allow_list", "external_google_skip_nonce_check", "jwt_exp", "security_captcha_enabled", "refresh_token_rotation_enabled", "security_refresh_token_reuse_interval", "sessions_timebox", "sessions_inactivity_timeout", "sessions_single_per_user", "rate_limit_token_refresh", "rate_limit_verify"} {
		if _, ok := auth[k]; !ok {
			return fmt.Errorf("Auth期待値の%sが未決定です", k)
		}
	}
	if auth["external_google_enabled"] != true {
		return errors.New("Google providerを維持してください")
	}
	var rest map[string]any
	_ = json.Unmarshal(e.Settings["postgrest"], &rest)
	schema, _ := rest["db_schema"].(string)
	if !includesSchema(schema, "public") {
		return errors.New("期待する公開schemaにpublicがありません")
	}
	if number(rest["max_rows"]) <= 0 {
		return errors.New("取得上限の期待値がありません")
	}
	return nil
}
func includesSchema(value, want string) bool {
	for _, v := range strings.Split(value, ",") {
		if strings.TrimSpace(v) == want {
			return true
		}
	}
	return false
}
func containsJSON(actual, want any) bool {
	if m, ok := want.(map[string]any); ok {
		a, ok := actual.(map[string]any)
		if !ok {
			return false
		}
		for k, v := range m {
			got, ok := a[k]
			if !ok || !containsJSON(got, v) {
				return false
			}
		}
		return true
	}
	return reflect.DeepEqual(actual, want)
}
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"
)

type row = map[string]any
type actor struct {
	token, refresh, uid  string
	user, book, category float64
}

var tables = []string{"users", "books", "book_members", "categories", "category_pins", "category_budgets", "monthly_budgets", "payments"}

func rpc(ctx context.Context, a api, token, name string, args row) (response, error) {
	return a.request(ctx, "POST", "/rest/v1/rpc/"+name, token, args)
}
func rows(ctx context.Context, a api, token, table, query string) ([]row, error) {
	r, e := a.request(ctx, "GET", "/rest/v1/"+table+"?select=*"+query, token, nil)
	if e != nil {
		return nil, e
	}
	var result []row
	e = r.decode(&result)
	return result, e
}
func number(v any) float64 { n, _ := v.(float64); return n }
func id(v float64) string  { return fmt.Sprintf("%.0f", v) }
func month() string {
	jst := time.FixedZone("JST", 9*3600)
	return time.Now().In(jst).Format("2006-01") + "-01"
}
func random() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func makeActor(ctx context.Context, a api, service, label string) (actor, error) {
	var user actor
	email := "ci-" + random() + "@example.com"
	password := "CI-a1!" + random()
	admin := api{a.base, service}
	r, e := admin.request(ctx, "POST", "/auth/v1/admin/users", service, row{"email": email, "password": password, "email_confirm": true})
	if e != nil {
		return user, e
	}
	if e = allowed(r); e != nil {
		return user, e
	}
	r, e = a.request(ctx, "POST", "/auth/v1/token?grant_type=password", "", row{"email": email, "password": password})
	if e != nil {
		return user, e
	}
	var session struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		User         struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if e = r.decode(&session); e != nil {
		return user, e
	}
	user.token = session.AccessToken
	user.refresh = session.RefreshToken
	user.uid = session.User.ID
	if user.token == "" || user.refresh == "" || user.uid == "" {
		return user, errors.New("テストsessionが不完全")
	}
	r, e = rpc(ctx, a, user.token, "ensure_authenticated_user", row{"p_initial_display_name": label})
	if e != nil {
		return user, e
	}
	if e = allowed(r); e != nil {
		return user, e
	}
	data, e := rows(ctx, a, user.token, "users", "")
	if e != nil || len(data) != 1 {
		return user, errors.New("本人profileの準備失敗")
	}
	user.user = number(data[0]["id"])
	data, e = rows(ctx, a, user.token, "books", "")
	if e != nil || len(data) != 1 {
		return user, errors.New("本人Bookの準備失敗")
	}
	user.book = number(data[0]["id"])
	r, e = rpc(ctx, a, user.token, "create_category_with_pin_and_budget", row{"p_category_name": label, "p_pinned": true, "p_effective_month": month(), "p_budget_amount": 1000})
	if e != nil {
		return user, e
	}
	if e = r.decode(&user.category); e != nil {
		return user, e
	}
	r, e = rpc(ctx, a, user.token, "create_monthly_budget", row{"p_effective_month": month(), "p_amount": 2000})
	if e != nil {
		return user, e
	}
	if e = allowed(r); e != nil {
		return user, e
	}
	r, e = a.request(ctx, "POST", "/rest/v1/payments", user.token, row{"amount": 10, "date": month(), "category_id": user.category})
	if e != nil {
		return user, e
	}
	return user, allowed(r)
}

func apiChecks(ctx context.Context, a api, service string) error {
	users := make([]actor, 2)
	for i := range users {
		u, e := makeActor(ctx, a, service, fmt.Sprintf("CI %d", i))
		if e != nil {
			return fmt.Errorf("fixture: %w", e)
		}
		users[i] = u
	}
	columnData, e := sql(ctx, `select coalesce(json_object_agg(name,columns),'{}') from (select c.relname as name,json_agg(a.attname order by a.attnum) as columns from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and a.attnum>0 and not a.attisdropped and a.attidentity='' and a.attgenerated='' group by c.relname) writable;`)
	if e != nil {
		return e
	}
	var insertColumns map[string][]string
	if e = json.Unmarshal(columnData, &insertColumns); e != nil {
		return e
	}
	for i, u := range users {
		other := users[1-i]
		for _, table := range tables {
			visible, e := rows(ctx, a, u.token, table, "")
			if e != nil || len(visible) != 1 {
				return fmt.Errorf("%s 本人参照が1件ではありません", table)
			}
			otherRows, e := rows(ctx, a, other.token, table, "")
			if e != nil || len(otherRows) != 1 {
				return fmt.Errorf("%s 別利用者fixture不足", table)
			}
			payload := row{}
			for _, key := range insertColumns[table] {
				if key != "created_at" && key != "updated_at" {
					payload[key] = otherRows[0][key]
				}
			}
			for _, token := range []string{u.token, ""} {
				inserted, err := a.request(ctx, "POST", "/rest/v1/"+table, token, payload)
				if err != nil {
					return err
				}
				if err = denied(inserted); err != nil {
					var failure struct{ Code, Message string }
					_ = json.Unmarshal(inserted.body, &failure)
					expected := map[string][2]string{
						"category_pins":    {"P0001", "Category pin category must belong to a member book."},
						"category_budgets": {"23514", "Category budget category must belong to the same book."},
						"payments":         {"P0001", "Payment category must belong to the same book."},
					}[table]
					if token == "" || inserted.status != 400 || expected[0] == "" || failure.Code != expected[0] || failure.Message != expected[1] {
						return fmt.Errorf("%s 他人の行の作成: %w (SQLSTATE=%s, %s)", table, err, failure.Code, redact(failure.Message))
					}
				}
			}
			target := id(number(otherRows[0]["id"]))
			r, e := a.request(ctx, "GET", "/rest/v1/"+table+"?id=eq."+target, u.token, nil)
			if e != nil {
				return e
			}
			if e = denied(r); e != nil {
				return fmt.Errorf("%s 別利用者参照: %w", table, e)
			}
			for _, method := range []string{"GET", "PATCH", "DELETE"} {
				var body any
				if method == "PATCH" {
					column := map[string]string{"users": "name", "books": "name", "book_members": "is_default", "categories": "name", "category_pins": "category_id", "category_budgets": "amount", "monthly_budgets": "amount", "payments": "amount"}[table]
					var value any
					switch column {
					case "name":
						value = fmt.Sprint(otherRows[0][column]) + " updated"
					case "is_default":
						value = otherRows[0][column] != true
					case "amount":
						value = number(otherRows[0][column]) + 1
					case "category_id":
						// 別の実在カテゴリを指定し、同値更新にしない。
						value = u.category
					}
					body = row{column: value}
				}
				for _, token := range []string{u.token, ""} {
					r, e = a.request(ctx, method, "/rest/v1/"+table+"?id=eq."+target, token, body)
					if e != nil {
						return e
					}
					if e = denied(r); e != nil {
						return fmt.Errorf("%s %s 境界: %w", table, method, e)
					}
				}
			}
			after, e := rows(ctx, a, other.token, table, "")
			if e != nil || !reflect.DeepEqual(after, otherRows) {
				return fmt.Errorf("%s 他人のデータが変更されました", table)
			}
		}
	}
	if e := catalogCoverage(ctx); e != nil {
		return e
	}
	if e := columnAndCRUD(ctx, a, users[0], users[1]); e != nil {
		return e
	}
	if e := paymentExportChecks(ctx, a, users[0], users[1]); e != nil {
		return e
	}
	if e := rpcChecks(ctx, a, users[0], users[1]); e != nil {
		return e
	}
	r, e := a.request(ctx, "POST", "/auth/v1/token?grant_type=refresh_token", "", row{"refresh_token": users[0].refresh})
	if e != nil {
		return e
	}
	var refreshed struct {
		AccessToken string `json:"access_token"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if e = r.decode(&refreshed); e != nil {
		return e
	}
	if refreshed.AccessToken == "" || refreshed.User.ID != users[0].uid {
		return errors.New("session更新で本人が変わりました")
	}
	data, e := rows(ctx, a, refreshed.AccessToken, "users", "")
	if e != nil || len(data) != 1 || number(data[0]["id"]) != users[0].user {
		return errors.New("更新後の本人取得失敗")
	}
	r, e = a.request(ctx, "PATCH", "/rest/v1/users?id=eq."+id(users[0].user), refreshed.AccessToken, row{"name": "refreshed"})
	if e != nil {
		return e
	}
	return allowed(r)
}

func columnAndCRUD(ctx context.Context, a api, u, other actor) error {
	r, e := a.request(ctx, "PATCH", "/rest/v1/users?id=eq."+id(u.user), u.token, row{"name": "updated", "language": "ja"})
	if e != nil {
		return e
	}
	if e = allowed(r); e != nil {
		return e
	}
	r, e = a.request(ctx, "PATCH", "/rest/v1/users?id=eq."+id(u.user), u.token, row{"auth_user_id": other.uid})
	if e != nil {
		return e
	}
	if e = denied(r); e != nil {
		return e
	}
	// 全列について本人更新権限の有無と実APIの応答を照合する。
	raw, e := sql(ctx, `select coalesce(json_agg(a.attname),'[]') from pg_attribute a where a.attrelid='public.users'::regclass and a.attnum>0 and not a.attisdropped and a.attidentity='' and a.attgenerated='' and not has_column_privilege('authenticated','public.users',a.attname,'UPDATE');`)
	if e != nil {
		return e
	}
	var forbidden []string
	if e = json.Unmarshal(raw, &forbidden); e != nil {
		return e
	}
	own, e := rows(ctx, a, u.token, "users", "")
	if e != nil {
		return e
	}
	for _, col := range forbidden {
		r, e = a.request(ctx, "PATCH", "/rest/v1/users?id=eq."+id(u.user), u.token, row{col: own[0][col]})
		if e != nil {
			return e
		}
		if e = denied(r); e != nil {
			return fmt.Errorf("保護列 %s: %w", col, e)
		}
	}
	baseline, e := rows(ctx, a, u.token, "monthly_budgets", "")
	if e != nil {
		return e
	}
	r, e = a.request(ctx, "POST", "/rest/v1/payments", u.token, row{"book_id": other.book, "amount": 77, "date": month()})
	if e != nil {
		return e
	}
	if e = denied(r); e != nil {
		return e
	}
	payment, e := rows(ctx, a, u.token, "payments", "")
	if e != nil {
		return e
	}
	paymentID := id(number(payment[0]["id"]))
	r, e = a.request(ctx, "PATCH", "/rest/v1/payments?id=eq."+paymentID, u.token, row{"book_id": other.book})
	if e != nil {
		return e
	}
	if e = allowed(r); e != nil {
		return e
	}
	check, e := rows(ctx, a, u.token, "payments", "")
	if e != nil || number(check[0]["book_id"]) != u.book {
		return errors.New("Book付け替えが成立しました")
	}
	r, e = a.request(ctx, "PATCH", "/rest/v1/payments?id=eq."+paymentID, u.token, row{"category_id": other.category})
	if e != nil {
		return e
	}
	if r.status != 400 && r.status != 403 {
		return fmt.Errorf("別Bookカテゴリの更新がHTTP %d", r.status)
	}
	r, e = a.request(ctx, "PATCH", "/rest/v1/payments?id=eq."+paymentID, u.token, row{"amount": 25})
	if e != nil {
		return e
	}
	if e = allowed(r); e != nil {
		return e
	}
	r, e = rpc(ctx, a, u.token, "get_monthly_total_amount", row{"p_month": month()[:7]})
	if e != nil {
		return e
	}
	var total float64
	if e = r.decode(&total); e != nil || total != 25 {
		return errors.New("月次集計が更新と一致しません")
	}
	r, e = a.request(ctx, "DELETE", "/rest/v1/payments?id=eq."+paymentID, u.token, nil)
	if e != nil {
		return e
	}
	if e = allowed(r); e != nil {
		return e
	}
	remaining, e := rows(ctx, a, u.token, "payments", "")
	if e != nil || len(remaining) != 0 {
		return errors.New("本人削除が反映されません")
	}
	after, e := rows(ctx, a, u.token, "monthly_budgets", "")
	if e != nil || !reflect.DeepEqual(baseline, after) {
		return errors.New("支払い操作で予算が変化しました")
	}
	// API上限を超えてもrange分割で全件と集計が一致することを確認する。
	batch := make([]row, 1001)
	for i := range batch {
		batch[i] = row{"amount": 1, "date": month()}
	}
	r, e = a.request(ctx, "POST", "/rest/v1/payments", u.token, batch)
	if e != nil {
		return e
	}
	if e = allowed(r); e != nil {
		return e
	}
	count := 0
	for offset := 0; offset < 1100; offset += 1000 {
		part, e := rows(ctx, a, u.token, "payments", "&order=id&offset="+fmt.Sprint(offset)+"&limit=1000")
		if e != nil {
			return e
		}
		count += len(part)
		if len(part) < 1000 {
			break
		}
	}
	if count != 1001 {
		return fmt.Errorf("API取得上限で欠落: %d/1001", count)
	}
	r, e = rpc(ctx, a, u.token, "get_monthly_total_amount", row{"p_month": month()[:7]})
	if e != nil {
		return e
	}
	if e = r.decode(&total); e != nil || total != 1001 {
		return errors.New("上限超過時の月次集計が不一致")
	}
	fmt.Println("PASS 取得上限を超えるAPI取得・DB集計（画面表示は別検証）")
	return nil
}

var rpcNames = []string{"export_payments", "create_category_with_pin", "update_category_with_pin", "ensure_authenticated_user", "get_authenticated_user_id", "get_authenticated_default_book_id", "get_monthly_total_amount", "get_effective_monthly_budget", "get_effective_category_budgets", "create_monthly_budget", "update_current_monthly_budget", "remove_current_monthly_budget", "create_category_with_pin_and_budget", "update_category_with_pin_and_budget", "delete_category_with_budget"}

func catalogCoverage(ctx context.Context) error {
	data, e := sql(ctx, `select json_build_object('tables',(select json_agg(relname order by relname) from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind in ('r','v','m','p')),'rpcs',(select json_agg(proname order by proname) from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and prorettype not in ('trigger'::regtype,'event_trigger'::regtype) and (has_function_privilege('authenticated',pg_proc.oid,'EXECUTE') or has_function_privilege('anon',pg_proc.oid,'EXECUTE'))));`)
	if e != nil {
		return e
	}
	var catalog struct{ Tables, RPCs []string }
	if e = json.Unmarshal(data, &catalog); e != nil {
		return e
	}
	for label, pair := range map[string][2][]string{"table": {tables, catalog.Tables}, "RPC": {rpcNames, catalog.RPCs}} {
		want, got := append([]string{}, pair[0]...), append([]string{}, pair[1]...)
		sort.Strings(want)
		sort.Strings(got)
		if !reflect.DeepEqual(want, got) {
			return fmt.Errorf("%s試験対象とcatalogが不一致: 試験=%v catalog=%v", label, want, got)
		}
	}
	return nil
}
func rpcChecks(ctx context.Context, a api, u, other actor) error {
	// 作成・更新・削除RPCを本人の一連の操作として実行する。
	created, err := rpc(ctx, a, u.token, "create_category_with_pin", row{"p_category_name": "legacy", "p_pinned": false})
	if err != nil {
		return err
	}
	var legacyID float64
	if err = created.decode(&legacyID); err != nil {
		return err
	}
	calls := []struct {
		name string
		args row
	}{
		{"ensure_authenticated_user", row{"p_initial_display_name": "again"}},
		{"update_category_with_pin", row{"p_category_id": legacyID, "p_category_name": "legacy updated", "p_pinned": false}},
		{"get_authenticated_user_id", row{}}, {"get_authenticated_default_book_id", row{}},
		{"get_monthly_total_amount", row{"p_month": month()[:7]}},
		{"get_effective_monthly_budget", row{"p_target_month": month()}},
		{"get_effective_category_budgets", row{"p_target_month": month()}},
		{"update_category_with_pin_and_budget", row{"p_category_id": u.category, "p_category_name": "updated", "p_pinned": true, "p_effective_month": month(), "p_budget_action": "keep"}},
	}
	for _, c := range calls {
		r, e := rpc(ctx, a, u.token, c.name, c.args)
		if e != nil {
			return e
		}
		if e = allowed(r); e != nil {
			return fmt.Errorf("RPC %s: %w", c.name, e)
		}
	}
	budgets, e := rows(ctx, a, u.token, "monthly_budgets", "")
	if e != nil {
		return e
	}
	budget := number(budgets[0]["id"])
	for _, c := range []struct {
		name string
		args row
	}{
		{"update_current_monthly_budget", row{"p_monthly_budget_id": budget, "p_amount": 2100}},
		{"remove_current_monthly_budget", row{"p_monthly_budget_id": budget}},
		{"create_monthly_budget", row{"p_effective_month": month(), "p_amount": 2000}},
	} {
		r, e := rpc(ctx, a, u.token, c.name, c.args)
		if e != nil {
			return e
		}
		if e = allowed(r); e != nil {
			return fmt.Errorf("RPC %s: %w", c.name, e)
		}
	}
	otherBefore, e := rows(ctx, a, other.token, "categories", "")
	if e != nil {
		return e
	}
	for _, name := range []string{"update_category_with_pin", "update_category_with_pin_and_budget", "delete_category_with_budget"} {
		args := row{"p_category_id": other.category}
		if strings.HasPrefix(name, "update_") {
			args["p_category_name"] = "forbidden"
			args["p_pinned"] = false
			if name == "update_category_with_pin_and_budget" {
				args["p_effective_month"] = month()
			}
		}
		r, e := rpc(ctx, a, u.token, name, args)
		if e != nil {
			return e
		}
		if r.status < 400 {
			return fmt.Errorf("RPC %s 他Book操作を拒否しません", name)
		}
	}
	after, e := rows(ctx, a, other.token, "categories", "")
	if e != nil || !reflect.DeepEqual(after, otherBefore) {
		return errors.New("RPCで他Bookが変化しました")
	}
	// 非認証は引数を含む正しい署名で拒否されることを確認する。
	anonymous := map[string]row{}
	for _, c := range calls {
		anonymous[c.name] = c.args
	}
	anonymous["export_payments"] = row{"p_book_id": u.book, "p_start_date": "2024-02-29", "p_end_date": "2025-02-28"}
	anonymous["create_monthly_budget"] = row{"p_effective_month": month(), "p_amount": 2000}
	anonymous["update_current_monthly_budget"] = row{"p_monthly_budget_id": budget, "p_amount": 2100}
	anonymous["remove_current_monthly_budget"] = row{"p_monthly_budget_id": budget}
	anonymous["create_category_with_pin_and_budget"] = row{"p_category_name": "anon", "p_pinned": false, "p_effective_month": month()}
	anonymous["create_category_with_pin"] = row{"p_category_name": "anonymous", "p_pinned": false}
	anonymous["delete_category_with_budget"] = row{"p_category_id": u.category}
	for _, name := range rpcNames {
		r, e := rpc(ctx, a, "", name, anonymous[name])
		if e != nil {
			return e
		}
		if e = denied(r); e != nil {
			return fmt.Errorf("RPC %s 未認証: %w", name, e)
		}
	}
	r, e := rpc(ctx, a, u.token, "delete_category_with_budget", row{"p_category_id": u.category})
	if e != nil {
		return e
	}
	return allowed(r)
}

package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

func checkAccountDeletionJobs(ctx context.Context, root string) error {
	ops, err := os.ReadFile(filepath.Join(root, "apps/api/supabase/operations/account_deletion_jobs.sql"))
	if err != nil {
		return err
	}
	// 隔離DBのpostgresも非superuserであり、migration直後は管理roleに切替できない。
	const setup = `do $$ begin
  if (select rolsuper from pg_roles where rolname = current_user)
      or pg_has_role(current_user, 'account_deletion_admin', 'SET') then
    raise exception 'Cronの検証にはSET権限のない非superuser登録者が必要';
  end if;
end; $$;
`
	const verify = `
do $$ begin
  if (select count(*) from cron.job
        where username = current_user and active and (jobname, schedule) in (
          ('burneto-account-deletion', '* 18 * * *'),
          ('burneto-account-deletion-retention', '0 18 * * *'))) <> 2 then
    raise exception '削除・保守ジョブの登録者またはスケジュールが不一致';
  end if;
  if pg_has_role(current_user, 'account_deletion_admin', 'USAGE') or exists (
      select from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
        and (pg_has_role(oid, 'account_deletion_admin', 'SET')
          or pg_has_role(oid, 'account_deletion_admin', 'USAGE'))) then
    raise exception '削除管理roleの権限が過剰';
  end if;
end; $$;
select command from cron.job where username = current_user
  and jobname in ('burneto-account-deletion', 'burneto-account-deletion-retention') order by jobname
\gexec
select cron.unschedule(jobid) from cron.job where username = current_user
  and jobname in ('burneto-account-deletion', 'burneto-account-deletion-retention');
`
	if _, err := sql(ctx, setup+string(ops)+verify); err != nil {
		return fmt.Errorf("削除・保守Cronの運用SQL: %w", err)
	}
	fmt.Println("PASS 非superuser登録者から削除・保守Cronの両ジョブ本文を実行")
	return nil
}

// OAuthそのものはHostedで別検証する。ここでは実Authが発行したsessionでDBの鮮度判定を通す。
func deletionSignIn(ctx context.Context, a api, u actor) (actor, error) {
	r, err := a.request(ctx, "POST", "/auth/v1/token?grant_type=password", "", row{"email": u.email, "password": u.password})
	if err != nil {
		return u, err
	}
	var session struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err = r.decode(&session); err != nil {
		return u, err
	}
	if session.AccessToken == "" || session.RefreshToken == "" {
		return u, errors.New("新しい本人sessionがありません")
	}
	u.token, u.refresh = session.AccessToken, session.RefreshToken
	return u, nil
}
func deletionResult(ctx context.Context, a api, token, name string, args row, want string) (row, error) {
	r, err := rpc(ctx, a, token, name, args)
	if err != nil {
		return nil, err
	}
	var result row
	if err = r.decode(&result); err != nil {
		return nil, fmt.Errorf("%s: %w", name, err)
	}
	if result["status"] != want {
		return nil, fmt.Errorf("%s: 期待状態%sと不一致", name, want)
	}
	return result, nil
}
func accountDeletionChecks(ctx context.Context, a api, service string) error {
	u, err := makeActor(ctx, a, service, "deletion")
	if err != nil {
		return err
	}
	other, err := makeActor(ctx, a, service, "retained")
	if err != nil {
		return err
	}
	// sessionの年齢だけを進め、実JWTを持つ既存本人が追加認証なしで予約できることを確認する。
	if _, err = sql(ctx, fmt.Sprintf("update auth.sessions set created_at=clock_timestamp()-interval '1 day' where user_id='%s';", u.uid)); err != nil {
		return err
	}
	r, err := rpc(ctx, a, u.token, "prepare_account_deletion", row{})
	if err != nil {
		return err
	}
	var preview row
	if err = r.decode(&preview); err != nil {
		return err
	}
	if _, hasFreshness := preview["session_fresh"]; preview["auth_user_id"] != u.uid || hasFreshness || preview["accepting_requests"] != false {
		return errors.New("削除previewの本人・応答契約・初期受付状態が不一致")
	}
	if _, err = sql(ctx, "update private.account_deletion_control set accepting_requests=true;"); err != nil {
		return err
	}
	requestID := "20872000-0000-4000-8000-000000000001"
	secret := random() + random()
	args := row{"request_id": requestID, "result_secret": secret, "explanation_version": "2026-11-06"}
	// 同一要求の並行再送は一つの予約と同じ期限に収束する。
	results := make([]row, 2)
	errs := make([]error, 2)
	var wg sync.WaitGroup
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i], errs[i] = deletionResult(ctx, a, u.token, "request_account_deletion", args, "pending")
		}(i)
	}
	wg.Wait()
	for _, e := range errs {
		if e != nil {
			return e
		}
	}
	if results[0]["delete_after"] != results[1]["delete_after"] {
		return errors.New("並行再送で期限が変化しました")
	}
	for _, table := range tables {
		response, e := a.request(ctx, "GET", "/rest/v1/"+table+"?select=*", u.token, nil)
		if e != nil {
			return e
		}
		if e = denied(response); e != nil {
			return fmt.Errorf("pending旧JWTの%s参照: %w", table, e)
		}
	}
	for _, c := range []struct {
		name string
		args row
	}{
		{"ensure_authenticated_user", row{"p_initial_display_name": "forbidden"}},
		{"get_authenticated_user_id", row{}},
		{"get_monthly_total_amount", row{"p_month": month()[:7]}},
		{"create_category_with_pin_and_budget", row{"p_category_name": "forbidden", "p_pinned": false, "p_effective_month": month()}},
		{"create_monthly_budget", row{"p_effective_month": month(), "p_amount": 1}},
	} {
		r, e := rpc(ctx, a, u.token, c.name, c.args)
		if e != nil {
			return e
		}
		if e = denied(r); e != nil {
			return fmt.Errorf("pending %s: %w", c.name, e)
		}
	}
	r, err = a.request(ctx, "POST", "/rest/v1/payments", u.token, row{"amount": 1, "date": month(), "book_id": u.book})
	if err != nil {
		return err
	}
	if err = denied(r); err != nil {
		return err
	}
	r, err = a.request(ctx, "PATCH", "/rest/v1/users?id=eq."+id(u.user), u.token, row{"name": "forbidden"})
	if err != nil {
		return err
	}
	if err = denied(r); err != nil {
		return err
	}
	state, err := deletionResult(ctx, a, u.token, "get_my_account_deletion_state", row{}, "pending")
	if err != nil {
		return err
	}
	if state["request_id"] != requestID || state["can_reactivate"] != true {
		return errors.New("端末情報なしの本人照会に失敗")
	}
	result, err := deletionResult(ctx, a, "", "get_account_deletion_result", row{"request_id": requestID, "result_secret": secret}, "pending")
	if err != nil {
		return err
	}
	if len(result) != 3 {
		return errors.New("匿名照会に状態と二つの時刻以外を公開しています")
	}
	if _, err = deletionResult(ctx, a, "", "get_account_deletion_result", row{"request_id": requestID, "result_secret": strings.Repeat("0", 64)}, "not_confirmed"); err != nil {
		return err
	}
	for _, token := range []string{u.token, other.token} {
		r, err = rpc(ctx, a, token, "reactivate_my_account", row{"request_id": requestID})
		if err != nil {
			return err
		}
		if err = denied(r); err != nil {
			return err
		}
	}
	// refreshはsession作成時刻を更新せず、pending解除の根拠にならない。
	r, err = a.request(ctx, "POST", "/auth/v1/token?grant_type=refresh_token", "", row{"refresh_token": u.refresh})
	if err != nil {
		return err
	}
	var refresh struct {
		AccessToken string `json:"access_token"`
	}
	if err = r.decode(&refresh); err != nil {
		return err
	}
	r, err = rpc(ctx, a, refresh.AccessToken, "reactivate_my_account", row{"request_id": requestID})
	if err != nil {
		return err
	}
	if err = denied(r); err != nil {
		return err
	}
	u, err = deletionSignIn(ctx, a, u)
	if err != nil {
		return err
	}
	if _, err = deletionResult(ctx, a, u.token, "reactivate_my_account", row{"request_id": requestID}, "cancelled"); err != nil {
		return err
	}
	data, err := rows(ctx, a, u.token, "users", "")
	if err != nil || len(data) != 1 || number(data[0]["id"]) != u.user {
		return errors.New("復帰後に同じprofileを再取得できません")
	}
	if _, err = deletionResult(ctx, a, "", "get_account_deletion_result", row{"request_id": requestID, "result_secret": secret}, "cancelled"); err != nil {
		return err
	}
	// 別受付番号の同時申請は、一方だけがpendingになる。
	ids := []string{"20872000-0000-4000-8000-000000000002", "20872000-0000-4000-8000-000000000003"}
	responses := make([]response, 2)
	for i := range ids {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			responses[i], errs[i] = rpc(ctx, a, u.token, "request_account_deletion", row{"request_id": ids[i], "result_secret": secret, "explanation_version": "2026-11-06"})
		}(i)
	}
	wg.Wait()
	winner := ""
	successes := 0
	for i, r := range responses {
		if errs[i] != nil {
			return errs[i]
		}
		if r.status == 200 {
			winner = ids[i]
			successes++
		} else if r.status != 409 {
			return fmt.Errorf("並行予約の敗者が期待外HTTP %d", r.status)
		}
	}
	if successes != 1 {
		return errors.New("別IDの並行予約が一件へ制限されません")
	}
	// 管理者が猶予終了を設定し、実Auth cascade後も旧JWTを拒否する。
	if _, err = sql(ctx, fmt.Sprintf("update private.account_deletion_requests set requested_at='2026-01-01',delete_after='2026-01-08',next_attempt_at='2026-01-08' where request_id='%s';select private.delete_account_request('%s');", winner, winner)); err != nil {
		return err
	}
	if _, err = deletionResult(ctx, a, "", "get_account_deletion_result", row{"request_id": winner, "result_secret": secret}, "completed"); err != nil {
		return err
	}
	r, err = rpc(ctx, a, u.token, "ensure_authenticated_user", row{"p_initial_display_name": "resurrected"})
	if err != nil {
		return err
	}
	if err = denied(r); err != nil {
		return err
	}
	data, err = rows(ctx, a, other.token, "users", "")
	if err != nil || len(data) != 1 {
		return errors.New("他人のprofileを維持できません")
	}
	fmt.Println("PASS 削除API: 既存sessionで追加認証なしの予約・並行申請・旧JWT/refresh停止・本人復帰・匿名照会・Auth削除")
	if err = deletionConcurrencyChecks(ctx); err != nil {
		return err
	}
	return deletionQueryPlanCheck(ctx)
}

// 非同期のSQLを開始した事実だけで競合成立とみなさず、lock保持後の待機を観測する。
func deletionBlocker(ctx context.Context, statement string) (<-chan error, error) {
	done := make(chan error, 1)
	go func() {
		_, err := sql(ctx, "set application_name='account-deletion-blocker';begin;"+statement+";select pg_sleep(2);commit;")
		done <- err
	}()
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(20 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case err := <-done:
			if err != nil {
				return nil, err
			}
			return nil, errors.New("競合試験のlock保持を観測できません")
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline.C:
			return nil, errors.New("競合試験のlock取得待機がtimeout")
		case <-tick.C:
			data, err := sql(ctx, "select count(*) from pg_stat_activity where application_name='account-deletion-blocker' and wait_event='PgSleep';")
			if err != nil {
				return nil, err
			}
			if strings.TrimSpace(string(data)) == "1" {
				return done, nil
			}
		}
	}
}
func deletionConcurrencyChecks(ctx context.Context) (err error) {
	// 複数接続ではtransaction内の関数置換を共有できないため、隔離DBでだけ時計を固定し必ず復元する。
	original, err := sql(ctx, "select pg_get_functiondef('private.delete_due_accounts()'::regprocedure);")
	if err != nil {
		return err
	}
	fixed := strings.ReplaceAll(string(original), "clock_timestamp()", "'2026-11-06 18:30:00+00'::timestamptz")
	if _, err = sql(ctx, fixed); err != nil {
		return err
	}
	defer func() { _, e := sql(ctx, string(original)); err = errors.Join(err, e) }()
	// 同じ共有Bookの最後の2人は異なる要求lockを持ち、Book lockで直列化する。
	setup := `insert into auth.users(id,email) values ('20874000-0000-0000-0000-000000000001','race-one@example.com'),('20874000-0000-0000-0000-000000000002','race-two@example.com');
 insert into public.users(auth_user_id,email,name) select id,email,'race' from auth.users where email like 'race-%@example.com';
 insert into public.book_members(book_id,user_id,is_default) select a.book_id,b.user_id,false from public.book_members a join public.users au on au.id=a.user_id cross join public.book_members b join public.users bu on bu.id=b.user_id where au.email='race-one@example.com' and bu.email='race-two@example.com';
 insert into private.account_deletion_requests(request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at) select id,id,extensions.digest(repeat('f',64),'sha256'),'2026-01-01','2026-01-08','2026-11-06','2026-01-08' from auth.users where email like 'race-%@example.com';`
	if _, err = sql(ctx, setup); err != nil {
		return err
	}
	batchBlocker, err := deletionBlocker(ctx, "select pg_advisory_xact_lock(pg_catalog.hashtextextended('account-deletion-batch',0))")
	if err != nil {
		return err
	}
	duplicate, duplicateErr := sql(ctx, "select private.delete_due_accounts();")
	if err = <-batchBlocker; err != nil {
		return err
	}
	if duplicateErr != nil {
		return duplicateErr
	}
	if strings.TrimSpace(string(duplicate)) != "0" {
		return errors.New("二重起動したbatchが削除を開始しました")
	}
	pending, err := sql(ctx, "select count(*) from private.account_deletion_requests where request_id::text like '20874000-%' and status='pending';")
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(pending)) != "2" {
		return errors.New("競合中のbatchが要求状態を変更しました")
	}
	bookData, err := sql(ctx, "select book_id from public.book_members join public.users on users.id=user_id where email='race-one@example.com';")
	if err != nil {
		return err
	}
	sharedBook := strings.TrimSpace(string(bookData))
	blocker, err := deletionBlocker(ctx, "select 1 from public.books where id="+sharedBook+" for update")
	if err != nil {
		return err
	}
	errs := make([]error, 2)
	var wg sync.WaitGroup
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = sql(ctx, fmt.Sprintf("select private.delete_account_request('20874000-0000-0000-0000-%012d');", i+1))
		}(i)
	}
	wg.Wait()
	if err = <-blocker; err != nil {
		return err
	}
	for _, e := range errs {
		if e != nil {
			return e
		}
	}
	result, err := sql(ctx, "select count(*) from public.books where id="+sharedBook+";")
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(result)) != "0" {
		return errors.New("最後の2memberの同時削除で無人Bookが残りました")
	}
	result, err = sql(ctx, "select count(*) from private.account_deletion_requests where request_id::text like '20874000-%' and status='completed';")
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(result)) != "2" {
		return errors.New("同時削除の2要求が完了しません")
	}
	// 期限前に開始してもlock待機後に期限を越えた復帰は拒否する。
	if _, err = sql(ctx, `insert into auth.users(id,email) values ('20874100-0000-0000-0000-000000000001','deadline@example.com');
 insert into public.users(auth_user_id,email,name) values ('20874100-0000-0000-0000-000000000001','deadline@example.com','deadline');
 with t as(select clock_timestamp()+interval '1 second' d) insert into private.account_deletion_requests(request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at) select '20874100-0000-0000-0000-000000000001','20874100-0000-0000-0000-000000000001',extensions.digest(repeat('a',64),'sha256'),d-interval '168 hours',d,'2026-11-06',d from t;
 insert into auth.sessions(id,user_id,created_at,updated_at) values ('20874100-0000-0000-0001-000000000001','20874100-0000-0000-0000-000000000001',clock_timestamp(),clock_timestamp());`); err != nil {
		return err
	}
	blocker, err = deletionBlocker(ctx, "select pg_advisory_xact_lock(private.account_deletion_lock_key('20874100-0000-0000-0000-000000000001'))")
	if err != nil {
		return err
	}
	_, reactivateErr := sql(ctx, `begin;select set_config('request.jwt.claims','{"sub":"20874100-0000-0000-0000-000000000001","session_id":"20874100-0000-0000-0001-000000000001"}',true);set local role authenticated;select public.reactivate_my_account('20874100-0000-0000-0000-000000000001');commit;`)
	if err = <-blocker; err != nil {
		return err
	}
	if reactivateErr == nil || !strings.Contains(reactivateErr.Error(), "Account reactivation deadline has passed") {
		return errors.New("lock待機後の期限切れが拒否されません")
	}
	// 先頭の大きな処理を模したtimeoutがbatchを原子的に戻し、延期後に後続10件を進める。
	if _, err = sql(ctx, `insert into auth.users(id,email) select ('20874200-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'timeout-'||i||'@example.com' from generate_series(1,11)i;
 insert into public.users(auth_user_id,email,name) select id,email,'timeout' from auth.users where email like 'timeout-%@example.com';
 insert into private.account_deletion_requests(request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at) select id,id,extensions.digest(repeat('a',64),'sha256'),'2025-01-01','2025-01-08','2026-11-06','2025-01-08' from auth.users where email like 'timeout-%@example.com';
 create function private.synthetic_slow_deletion() returns trigger language plpgsql as $$begin if old.id='20874200-0000-0000-0000-000000000001' then perform pg_sleep(1);end if;return old;end;$$;
 create trigger synthetic_slow_deletion before delete on auth.users for each row execute function private.synthetic_slow_deletion();`); err != nil {
		return err
	}
	for range 2 {
		_, timeoutErr := sql(ctx, "set statement_timeout='100ms';select private.delete_due_accounts();")
		if timeoutErr == nil || !strings.Contains(timeoutErr.Error(), "statement timeout") {
			return errors.New("先頭候補のtimeoutが観測されません")
		}
		result, err = sql(ctx, "select count(*) from auth.users where email like 'timeout-%@example.com';")
		if err != nil {
			return err
		}
		if strings.TrimSpace(string(result)) != "11" {
			return errors.New("batch timeoutで部分削除されました")
		}
	}
	if _, err = sql(ctx, "select private.defer_account_deletion('20874200-0000-0000-0000-000000000001',clock_timestamp()+interval '1 hour');"); err != nil {
		return err
	}
	result, err = sql(ctx, "select private.delete_due_accounts();")
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(result)) != "10" {
		return errors.New("先頭延期後に後続10件を処理できません")
	}
	if _, err = sql(ctx, "drop trigger synthetic_slow_deletion on auth.users;drop function private.synthetic_slow_deletion();update private.account_deletion_requests set next_attempt_at=clock_timestamp() where request_id='20874200-0000-0000-0000-000000000001';"); err != nil {
		return err
	}
	result, err = sql(ctx, "select private.delete_account_request('20874200-0000-0000-0000-000000000001');")
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(result)) != "t" {
		return errors.New("timeout原因解消後に同じ要求が完了しません")
	}
	fmt.Println("PASS 削除競合: 二重batch・最後の2member・lock待機後期限判定・11件の連続timeoutと単件延期復旧")
	return nil
}

func deletionQueryPlanCheck(ctx context.Context) error {
	// 少数・集中・延期多数の分布を同じ管理roleの内部SQLで確認する。
	for _, tc := range []struct{ count, eligible int }{{50, 50}, {11000, 11000}, {11000, 5}} {
		query := fmt.Sprintf(`begin;
 insert into private.account_deletion_requests(request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at)
 select ('20874300-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,('20874300-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,extensions.digest(repeat('b',64),'sha256'),'2024-01-01','2024-01-08','2026-11-06',case when i<=%d then '2024-01-08'::timestamptz else '2099-01-01'::timestamptz end from generate_series(1,%d)i;
 analyze private.account_deletion_requests;
 explain(analyze,buffers,format json) select request_id from private.account_deletion_requests where status='pending' and private.account_deletion_purge_after(delete_after)<=statement_timestamp() and next_attempt_at<=statement_timestamp() order by private.account_deletion_purge_after(delete_after),request_id limit 10;
 rollback;`, tc.eligible, tc.count)
		data, err := sql(ctx, query)
		if err != nil {
			return err
		}
		// psqlのcommand tagを除き、EXPLAINのJSONだけ解析する。
		raw := string(data)
		start, end := strings.Index(raw, "["), strings.LastIndex(raw, "]")
		if start < 0 || end < start {
			return errors.New("削除候補の実行計画を取得できません")
		}
		var plan []map[string]any
		if err = json.Unmarshal([]byte(raw[start:end+1]), &plan); err != nil {
			return err
		}
		var sorted bool
		var removed float64
		var visit func(any)
		visit = func(value any) {
			switch v := value.(type) {
			case map[string]any:
				if v["Node Type"] == "Sort" {
					sorted = true
				}
				removed += number(v["Rows Removed by Filter"])
				for _, x := range v {
					visit(x)
				}
			case []any:
				for _, x := range v {
					visit(x)
				}
			}
		}
		visit(plan[0])
		if sorted && tc.count >= 11000 {
			return errors.New("削除候補LIMIT前に全件Sortが発生しました")
		}
		fmt.Printf("PASS 削除候補計画: 件数=%d eligible=%d 制限前Sortなし filter除外=%.0f\n", tc.count, tc.eligible, removed)
	}
	return nil
}

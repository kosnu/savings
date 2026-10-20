package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

func paymentExportChecks(ctx context.Context, a api, u, other actor) error {
	foreign, err := a.request(ctx, "POST", "/rest/v1/payments", other.token, row{"book_id": other.book, "date": "2024-02-29", "amount": 99, "note": "export-foreign"})
	if err != nil {
		return err
	}
	if err = allowed(foreign); err != nil {
		return err
	}
	args := row{"p_book_id": u.book, "p_start_date": "2024-02-29", "p_end_date": "2025-02-28"}
	check := func(want int, book float64) error {
		request := row{"p_book_id": book, "p_start_date": args["p_start_date"], "p_end_date": args["p_end_date"]}
		r, err := rpc(ctx, a, u.token, "export_payments", request)
		if err != nil {
			return err
		}
		var result struct {
			Count    int
			Payments []row
		}
		if err = r.decode(&result); err != nil {
			return err
		}
		size := want
		if want > 10000 {
			size = 0
		}
		if result.Count != want || len(result.Payments) != size {
			return fmt.Errorf("export RPC 件数/明細が不一致: count=%d rows=%d want=%d", result.Count, len(result.Payments), want)
		}
		for i, p := range result.Payments {
			if number(p["book_id"]) != book || p["date"] != "2024-02-29" || number(p["amount"]) != 1234 {
				return errors.New("export RPC Book・日付・金額が不一致")
			}
			if i > 0 && number(result.Payments[i-1]["id"]) >= number(p["id"]) {
				return errors.New("export RPC 順序不一致または重複")
			}
		}
		return nil
	}
	for _, batch := range []int{1001, 8999, 1} {
		data := make([]row, batch)
		for i := range data {
			data[i] = row{"book_id": u.book, "date": "2024-02-29", "amount": 1234, "note": "export"}
		}
		r, err := a.request(ctx, "POST", "/rest/v1/payments", u.token, data)
		if err != nil {
			return err
		}
		if err = allowed(r); err != nil {
			return err
		}
		want := 1001
		if batch == 8999 {
			want = 10000
		}
		if batch == 1 {
			want = 10001
		}
		if err = check(want, u.book); err != nil {
			return err
		}
	}
	// 他利用者のBookはRLSにより空。未認証は正しい署名でも拒否する。
	if err := check(0, other.book); err != nil {
		return err
	}
	r, err := rpc(ctx, a, "", "export_payments", args)
	if err != nil {
		return err
	}
	if err = denied(r); err != nil {
		return err
	}
	args["p_end_date"] = "2025-03-01"
	r, err = rpc(ctx, a, u.token, "export_payments", args)
	if err != nil {
		return err
	}
	var invalid struct{ Code string }
	if json.Unmarshal(r.body, &invalid) != nil || r.status != 400 || invalid.Code != "22023" {
		return errors.New("export RPC 最大1年超過の入力エラーが不一致")
	}
	r, err = a.request(ctx, "DELETE", "/rest/v1/payments?note=eq.export", u.token, nil)
	if err != nil {
		return err
	}
	if err = allowed(r); err != nil {
		return err
	}
	if err = paymentExportConcurrentChecks(ctx, a, u); err != nil {
		return err
	}
	r, err = a.request(ctx, "DELETE", "/rest/v1/payments?note=eq.export-foreign", other.token, nil)
	if err != nil {
		return err
	}
	if err = allowed(r); err != nil {
		return err
	}
	fmt.Println("PASS export RPC 単一JSON・1001/10000/10001件・Book分離・未認証・最大1年")
	return nil
}

// 同じ件数の全行入替えを並行commitしても、明細は単一世代の完全な集合になる。
func paymentExportConcurrentChecks(ctx context.Context, a api, u actor) error {
	replace := func(generation int) error {
		_, err := sql(ctx, fmt.Sprintf(`begin;
      delete from public.payments where book_id=%s and date='2024-02-29';
      insert into public.payments(book_id,date,amount,note)
      select %s, '2024-02-29', 1234, 'export-race-%d' from generate_series(1,1001);
      commit;`, id(u.book), id(u.book), generation))
		return err
	}
	if err := replace(0); err != nil {
		return err
	}
	writes := make(chan error, 1)
	go func() {
		for generation := 1; generation <= 6; generation++ {
			if err := replace(generation); err != nil {
				writes <- err
				return
			}
		}
		writes <- nil
	}()
	var readErr error
	for attempt := 0; attempt < 12; attempt++ {
		r, err := rpc(ctx, a, u.token, "export_payments", row{"p_book_id": u.book, "p_start_date": "2024-02-29", "p_end_date": "2025-02-28"})
		if err != nil {
			readErr = err
			break
		}
		var result struct {
			Count    int
			Payments []row
		}
		if err = r.decode(&result); err != nil {
			readErr = err
			break
		}
		if result.Count != 1001 || len(result.Payments) != 1001 {
			readErr = errors.New("export RPC 並行入替えで明細が欠落しました")
			break
		}
		ids := map[float64]bool{}
		generation := result.Payments[0]["note"]
		for _, p := range result.Payments {
			key := number(p["id"])
			if ids[key] || p["note"] != generation {
				readErr = errors.New("export RPC 並行入替えで世代混在または重複しました")
				break
			}
			ids[key] = true
		}
		if readErr != nil {
			break
		}
	}
	// 開始した書込みを終えてから結果を返し、検証環境の破棄と競合させない。
	if err := <-writes; err != nil {
		return err
	}
	if readErr != nil {
		return readErr
	}
	r, err := a.request(ctx, "DELETE", "/rest/v1/payments?note=like.export-race-*", u.token, nil)
	if err != nil {
		return err
	}
	return allowed(r)
}

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

var client = &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}

type api struct{ base, key string }
type response struct {
	status int
	body   []byte
	header http.Header
}

func (a api) request(ctx context.Context, method, path, token string, body any) (response, error) {
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return response{}, err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, a.base+path, bytes.NewReader(data))
	if err != nil {
		return response{}, err
	}
	if a.key != "" {
		req.Header.Set("apikey", a.key)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	r, err := client.Do(req)
	if err != nil {
		return response{}, fmt.Errorf("%s %s: 通信失敗", method, path)
	}
	defer r.Body.Close()
	data, err = io.ReadAll(io.LimitReader(r.Body, 16<<20))
	if err != nil {
		return response{}, err
	}
	return response{r.StatusCode, data, r.Header}, nil
}
func (r response) decode(v any) error {
	if r.status < 200 || r.status >= 300 {
		return fmt.Errorf("HTTP %d", r.status)
	}
	return json.Unmarshal(r.body, v)
}
func allowed(r response) error {
	if r.status < 200 || r.status >= 300 {
		return fmt.Errorf("正常操作がHTTP %d", r.status)
	}
	return nil
}
func denied(r response) error {
	if r.status == 401 || r.status == 403 {
		var e struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(r.body, &e)
		if e.Code == "42501" {
			return nil
		}
		return fmt.Errorf("権限拒否以外のHTTP %d", r.status)
	}
	if r.status >= 200 && r.status < 300 {
		var rows []any
		if json.Unmarshal(r.body, &rows) == nil && len(rows) == 0 {
			return nil
		}
	}
	return fmt.Errorf("拒否されるべき操作がHTTP %d", r.status)
}

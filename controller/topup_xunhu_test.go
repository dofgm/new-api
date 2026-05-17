package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting"
)

func TestGenerateXunhuHash_DeterministicSorted(t *testing.T) {
	params := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
	}
	first := generateXunhuHash(params, "SECRET")
	second := generateXunhuHash(params, "SECRET")
	if first != second {
		t.Fatalf("hash not deterministic: %s vs %s", first, second)
	}
}

func TestGenerateXunhuHash_SkipsEmptyAndHashField(t *testing.T) {
	withHashAndEmpty := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
		"hash":           "should-be-skipped",
		"empty_field":    "",
	}
	expected := generateXunhuHash(map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
	}, "SECRET")
	got := generateXunhuHash(withHashAndEmpty, "SECRET")
	if got != expected {
		t.Fatalf("expected %s, got %s — empty / hash fields not skipped", expected, got)
	}
}

func TestGenerateXunhuHash_KeyOrderInsensitive(t *testing.T) {
	a := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
		"total_fee":      "1",
		"nonce_str":      "abc",
	}
	b := map[string]string{
		"nonce_str":      "abc",
		"total_fee":      "1",
		"trade_order_id": "ORDER",
		"appid":          "APP",
	}
	if generateXunhuHash(a, "SECRET") != generateXunhuHash(b, "SECRET") {
		t.Fatal("map insertion order changed hash result")
	}
}

func TestGenerateXunhuHash_KnownVector(t *testing.T) {
	params := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
	}
	want := "f1c387d4c6ea40f6d636345b4398d813"
	got := generateXunhuHash(params, "SECRET")
	if got != want {
		t.Fatalf("known vector mismatch: want %s got %s", want, got)
	}
}

func TestVerifyXunhuHash_RoundTrip(t *testing.T) {
	params := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
		"total_fee":      "9.9",
	}
	params["hash"] = generateXunhuHash(params, "SECRET")
	if !verifyXunhuHash(params, "SECRET") {
		t.Fatal("round trip verification failed")
	}
}

func TestVerifyXunhuHash_WrongSecret(t *testing.T) {
	params := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
	}
	params["hash"] = generateXunhuHash(params, "RIGHT")
	if verifyXunhuHash(params, "WRONG") {
		t.Fatal("verification should fail with wrong secret")
	}
}

func TestVerifyXunhuHash_MissingHash(t *testing.T) {
	params := map[string]string{
		"appid":          "APP",
		"trade_order_id": "ORDER",
	}
	if verifyXunhuHash(params, "SECRET") {
		t.Fatal("verification should fail when hash field is missing")
	}
}

func TestIsXunhuMobileUA(t *testing.T) {
	cases := []struct {
		ua     string
		mobile bool
	}{
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.15", true},
		{"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36", true},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) MicroMessenger/8.0", true},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120", false},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", false},
		{"", false},
	}
	for _, tc := range cases {
		got := isXunhuMobileUA(tc.ua)
		if got != tc.mobile {
			t.Errorf("UA=%q want mobile=%v got %v", tc.ua, tc.mobile, got)
		}
	}
}

func TestBuildXunhuPayParams_FormatTotalFee(t *testing.T) {
	cases := []struct {
		money float64
		want  string
	}{
		{1.0, "1"},
		{1.5, "1.5"},
		{99.99, "99.99"},
		{100, "100"},
	}
	for _, tc := range cases {
		params := buildXunhuPayParams("APP", "ORDER", "充值 100", tc.money, "https://example.com/notify", "https://example.com/return", "")
		if got := params["total_fee"]; got != tc.want {
			t.Errorf("money=%v want total_fee=%q got %q", tc.money, tc.want, got)
		}
		if params["appid"] != "APP" {
			t.Errorf("appid not propagated: %q", params["appid"])
		}
		if params["trade_order_id"] != "ORDER" {
			t.Errorf("trade_order_id not propagated: %q", params["trade_order_id"])
		}
		if params["notify_url"] != "https://example.com/notify" {
			t.Errorf("notify_url not propagated: %q", params["notify_url"])
		}
		if _, ok := params["hash"]; ok {
			t.Error("hash should not be present in build result")
		}
	}
}

func TestFormatXunhuTotalFee(t *testing.T) {
	cases := []struct {
		in   float64
		want string
	}{
		{1, "1"},
		{1.0, "1"},
		{1.5, "1.5"},
		{99.99, "99.99"},
		{0.01, "0.01"},
	}
	for _, tc := range cases {
		got := formatXunhuTotalFee(tc.in)
		if got != tc.want {
			t.Errorf("formatXunhuTotalFee(%v) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestSanitizeXunhuTitle(t *testing.T) {
	if got := sanitizeXunhuTitle("hello%world"); got != "helloworld" {
		t.Errorf("percent not stripped: %q", got)
	}
	long := strings.Repeat("a", 200)
	got := sanitizeXunhuTitle(long)
	if len(got) > 127 {
		t.Errorf("title not truncated to 127 bytes: len=%d", len(got))
	}
	if !strings.HasPrefix(long, got) {
		t.Errorf("truncation should preserve prefix")
	}
}

// withFastBackoffs 临时把重试间隔降到 ~1ms，避免单测被 sleep 拖慢。
func withFastBackoffs(t *testing.T) {
	t.Helper()
	saved := xunhuRetryBackoffs
	xunhuRetryBackoffs = []time.Duration{0, time.Millisecond, time.Millisecond}
	t.Cleanup(func() { xunhuRetryBackoffs = saved })
}

func TestCallXunhuPayWithRetry_RetriesOnTransient(t *testing.T) {
	withFastBackoffs(t)
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n < 3 {
			// 模拟瞬时故障：关掉连接
			hj, ok := w.(http.Hijacker)
			if ok {
				conn, _, _ := hj.Hijack()
				_ = conn.Close()
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"openid":123,"url_qrcode":"https://example.com/q.png","url":"","errcode":0,"errmsg":"success!","hash":""}`))
	}))
	defer srv.Close()

	saved := setting.XunhuApiUrl
	setting.XunhuApiUrl = srv.URL
	defer func() { setting.XunhuApiUrl = saved }()

	resp, _, err := callXunhuPayWithRetry(map[string]string{"appid": "A"})
	if err != nil {
		t.Fatalf("expected eventual success, got error: %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Errorf("expected 3 attempts, got %d", got)
	}
	if resp == nil || resp.UrlQrcode == "" {
		t.Errorf("expected qrcode in response, got %+v", resp)
	}
}

func TestCallXunhuPayWithRetry_NoRetryOnParseFailure(t *testing.T) {
	withFastBackoffs(t)
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		_, _ = w.Write([]byte("not-json-at-all"))
	}))
	defer srv.Close()

	saved := setting.XunhuApiUrl
	setting.XunhuApiUrl = srv.URL
	defer func() { setting.XunhuApiUrl = saved }()

	_, _, err := callXunhuPayWithRetry(map[string]string{"appid": "A"})
	if err == nil {
		t.Fatal("expected parse error, got nil")
	}
	if !errors.Is(err, errXunhuParseFailed) {
		t.Errorf("expected errXunhuParseFailed, got %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Errorf("parse failures should not retry, got %d attempts", got)
	}
}

func TestCallXunhuPayWithRetry_ExhaustsRetries(t *testing.T) {
	withFastBackoffs(t)
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		hj, ok := w.(http.Hijacker)
		if ok {
			conn, _, _ := hj.Hijack()
			_ = conn.Close()
		}
	}))
	defer srv.Close()

	saved := setting.XunhuApiUrl
	setting.XunhuApiUrl = srv.URL
	defer func() { setting.XunhuApiUrl = saved }()

	_, _, err := callXunhuPayWithRetry(map[string]string{"appid": "A"})
	if err == nil {
		t.Fatal("expected error after exhausting retries")
	}
	if got := atomic.LoadInt32(&calls); int(got) != len(xunhuRetryBackoffs) {
		t.Errorf("expected %d attempts, got %d", len(xunhuRetryBackoffs), got)
	}
}

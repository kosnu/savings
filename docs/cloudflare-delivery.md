---
title: Cloudflare 配信確認
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - apps/web/public/_headers
  - apps/web/cloudflare.config.ts
  - apps/web/vite.config.ts
topics:
  - cloudflare
  - security
  - caching
  - performance
  - rollback
when_to_read:
  - Cloudflare の公開設定・HTTP 配信を確認するとき
  - 静的配信ヘッダーを変更または本番反映するとき
---

# Cloudflare 配信確認

[Issue #1886](https://github.com/kosnu/savings/issues/1886) の対象は静的配信。
2026-10-12 UTC に Cloudflare API の読み取りと匿名 HTTP・ブラウザ閲覧で確認した。
設定変更・デプロイは未実施。本番の受入確認が残るため Issue は閉じない。
比較元は main の 96ac88027b7c6141578d008ba1f5c16a945cb617。
secret の値、管理者の氏名・メール、利用者データ、生ログは記録しない。

## 実設定と採用判断

| 対象           | 確認した実設定・応答                                                                                                                                                                | 判断・限界                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS / hostname | active の Free Website zone。apex は proxied AAAA。`burneto.com` は production の `burneto` Custom Domain                                                                           | repo と一致。DNS・ドメイン移管は不要                                                                                                                                        |
| 本番配信       | active version `b74cf1b1-face-4d4e-901e-3a935308f5d1`、100%、2026-10-12 11:48 UTC、cf_cli。compatibility date は `2026-09-18`、binding なし                                         | repo と同じ静的構成。API の settings は assets 設定を返さないため、SPA は実応答で確認。version と Git commit の対応は別途確認が必要                                         |
| HTTPS / TLS    | HTTPS 200、HTTP も 200。Always Use HTTPS off、最低 TLS 1.0、TLS 1.3 on、SSL full。Custom Domain と Universal 証明書は active                                                        | HTTP 転送 on と最低 TLS 1.2 を承認候補にする。Workers は Cloudflare が TLS を終端するため、外部 origin の証明書検証用 Full (strict) へ変える効果を仮定しない                |
| HSTS           | zone の HSTS off、実応答にもなし                                                                                                                                                    | まず HTTP 転送を確認。長期 max-age / includeSubDomains / preload は HTTPS の復旧を難しくするため今回追加しない                                                              |
| 管理者         | accepted member 1 名、Super Administrator、MFA 有効                                                                                                                                 | 管理者変更は不要。MFA recovery の保管状態は API から分からない                                                                                                              |
| deploy token   | account/user token 一覧は権限拒否（9109）                                                                                                                                           | GitHub の `CLOUDFLARE_API_TOKEN` がどの token か、対象 account/zone、permission group、期限は未確認。値を取得せず所有者側で metadata を確認する。再発行・権限変更は別途承認 |
| ヘッダー       | 本番に CSP / nosniff / X-Frame-Options / Referrer-Policy なし。repo に `_headers` なし                                                                                              | [public/_headers](../apps/web/public/_headers) を追加。ローカルで応答を確認。本番反映は承認後                                                                               |
| 不正利用対策   | Bot Fight Mode off。custom / rate-limit / managed phase の zone entrypoint は存在しない。一覧には Free Managed と DDoS の managed ruleset がある                                    | ruleset の存在だけで適用済みとはしない。DDoS の標準保護は維持。Free Managed の有効状態は Dashboard で確認。新しい遮断を根拠なく追加しない                                   |
| キャッシュ     | HTML / JS / CSS と欠落アセットの HTML が `public, max-age=0, must-revalidate`。JS/CSS に ETag、条件付き JS GET は 304。HTML の ETag は本番応答にはなし。cache phase entrypoint なし | 標準キャッシュを維持。zone の browser cache TTL 14400 を静的実応答の TTL と混同しない。HTML の更新時再取得を維持し、利用者別データの共有キャッシュを追加しない              |
| 圧縮           | zone Brotli on。curl の対応 encoding で HTML / JS / CSS の gzip 応答を確認                                                                                                          | 圧縮は機能している。設定 on だけで常に Brotli 応答と扱わず、独自の圧縮処理を追加しない                                                                                      |
| SPA            | `/`、`/payments`、`/auth`、`/privacy` は HTML 200。存在しない JS / map URL も HTML 200                                                                                              | native SPA fallback を維持。map の非公開判定は status だけでなく本文種別を確認する                                                                                          |
| 公開成果物     | HTML が参照する3つの JS に sourceMappingURL なし。index/vendor の map URL は HTML。既知の管理秘密形式の値はこれらの JS に検出なし                                                   | 全秘密形式の不在を保証しない。vendor 内の `sb_secret_` 接頭辞だけはキー種別判定等の SDK 文字列と区別する。環境値・session は出力しない                                      |
| Dev / 旧 Pages | Worker 一覧は `burneto` のみ。本番 workers.dev / version previews は false。旧 `savings-dyo.pages.dev` は公開 200、domain は pages.dev のみ                                         | repo の `burneto-dev` は設定上の分離で、配信済みとは扱わない。旧 Pages は復旧先として保持。削除・転送・Access・preview 公開範囲変更はしない                                 |

旧 Pages の production deployment は `58fdaccf-aa19-4380-a949-f9d2dad8659f`、
commit は bf8d5da164b6025d486631b13ad6438648ed679a（2026-09-21）。
旧配信物は現行の Web と同一ではなく、新しいログイン入口として保証しない。

## ヘッダーと防御範囲

[Workers のヘッダー仕様](https://developers.cloudflare.com/workers/static-assets/headers/)に従い、
Vite public から assets 出力へ `_headers` をコピーする。Worker サーバーコードは不要。
CSP は `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`。
外部 base URL、object 埋込、他サイトからの frame 埋込を防ぐ。
`X-Frame-Options: DENY` を併用し、`nosniff` で欠落 JS に返った HTML の script 実行を拒否する。
`Referrer-Policy: no-referrer` は callback URL 等を参照元として送らない。
未使用の camera / microphone / geolocation を Permissions-Policy で無効化する。

この CSP は script の XSS 防止用 allowlist ではない。
`default-src` / `script-src` / `style-src` / `connect-src` / `form-action` を設定しないため、
既存の inline style、Google へのトップレベル遷移、Supabase・Sentry 通信を制限しない。
COOP / COEP は OAuth popup や外部資源への影響を検証していないため追加しない。
ローカルでは通常表示に CSP 違反なし、外部 base の拒否、合成 Supabase/Sentry fetch の成功を確認した。
本物の Google ログイン、既存 session、Sentry イベント受信・map 解決は未確認。

[Free custom rules](https://developers.cloudflare.com/waf/custom-rules/) は5件、Log action と regex は利用不可。
[rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) は Free で1件などプラン別の制約がある。
[Managed Rules](https://developers.cloudflare.com/waf/managed-rules/) では Free Managed が利用でき、
Cloudflare Managed / OWASP 全体は Free の対象外。
[Bot Fight Mode](https://developers.cloudflare.com/waf/feature-interoperability/) は Free で利用できるが、
custom rule の Skip で例外化できない。正常利用の誤検知を避けるため off を維持する。
静的ファイルを一律に厳しい IP レートで制限すると、並列読込や共有 NAT を遮断し得る。
攻撃・正常利用の観測に根拠がないため閾値を発明しない。

zone の対策は proxied `burneto.com` の Cloudflare 経路が対象。
`pages.dev` / `workers.dev` にこの zone のルールが適用されると扱わない。
Google / Supabase callback、直接 `*.supabase.co` へ送る Auth / Data API は保護範囲外。
Cloudflare WAF を Supabase API の防御として説明せず、Supabase 設定も変更しない。

## キャッシュと性能

ハッシュ付き JS/CSS は ETag による 304 とブラウザ再利用が実際に機能している。
`/assets/*` を immutable にすると、SPA fallback の欠落 URL に返る HTML も長期保存し得る。
今回は標準再検証を維持し、HTML 全体の長期 TTL・Cache Everything を設定しない。
更新後の index.html が参照する全ファイルと、旧ページを開いたままの遅延読込は本番反映後に確認する。
静的成果物だけを切り戻す。DB / Auth / 利用者データを戻す操作は含めない。

2026-10-12 15:46 UTC、同じ Mac・接続、HeadlessChrome 155、1280×720、ja-JP、
CPU/ネットワーク throttling なし、匿名 `/`、service worker 無効。
独立 context 3個で各1回の初回、同じ context で about:blank を経由して再訪。
networkidle 後2秒までの Navigation/Resource Timing と PerformanceObserver を使用。
実測3組の中央値（TTFB は navigation start → responseStart）:

| 指標                                            |         初回 |       再訪 |
| ----------------------------------------------- | -----------: | ---------: |
| TTFB                                            |     260.7 ms |   122.3 ms |
| loadEventEnd                                    |     920.9 ms |   415.0 ms |
| FCP                                             |       968 ms |     456 ms |
| LCP                                             |      1028 ms |     456 ms |
| CLS                                             |            0 |          0 |
| 同一 origin の transferSize 合計                | 495043 bytes | 4602 bytes |
| 同一 origin の timing entry 数（document 含む） |           13 |         13 |

初回 TTFB は 256.9–876.8 ms、LCP は 1004–1928 ms とばらつく。
転送量は Timing API のサイズであり、TLS/HTTP 全体の wire byte 数ではない。
cross-origin の通信は合計に含めない。操作を伴う INP と実利用者 p75、認証済み画面は未測定。
Chrome DevTools MCP はないため trace / Lighthouse の結果として扱わない。
再訪は十分小さく、今回の標準キャッシュ維持を支持するが、全利用者の性能を保証しない。
変更後の本番値は未測定。ローカル応答と本番を性能比較して改善と主張しない。

### 同条件での再測定

Playwright CLI の専用匿名ブラウザを開き、次のコードを一時ファイル `measure.js` に置いて
`playwright-cli -s=delivery run-code --filename measure.js` を実行する。
新しい context は session を共有しない。対象はトップページのみで、負荷試験ではない。
前後の active version・日時・ブラウザ版・接続条件を照合し、版が変われば比較の限界を示す。
生出力・URL query・cookie・storage・trace を保存せず、中央値と不足だけを要約する。

```text
async (page) => {
  const results = []
  for (let sample = 1; sample <= 3; sample++) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width: 1280, height: 720 },
        locale: "ja-JP",
        serviceWorkers: "block",
      })
    await context.addInitScript(() => {
      window.delivery = { lcp: null, cls: 0 }
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.delivery.lcp = e.startTime
      }).observe({ type: "largest-contentful-paint", buffered: true })
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.delivery.cls += e.value
      }).observe({ type: "layout-shift", buffered: true })
    })
    const p = await context.newPage()
    for (const visit of ["first", "revisit"]) {
      await p.goto("https://burneto.com/", { waitUntil: "networkidle" })
      await p.waitForTimeout(2000)
      results.push(
        await p.evaluate(
          ({ sample, visit }) => {
            const n = performance.getEntriesByType("navigation")[0]
            const r = performance
              .getEntriesByType("resource")
              .filter((e) => new URL(e.name).origin === location.origin)
            return {
              sample,
              visit,
              ttfb: n.responseStart - n.startTime,
              load: n.loadEventEnd,
              fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
              ...window.delivery,
              transferBytes: n.transferSize + r.reduce((s, e) => s + e.transferSize, 0),
              requests: r.length + 1,
            }
          },
          { sample, visit },
        ),
      )
      await p.goto("about:blank")
    }
    await context.close()
  }
  return results
}
```

## 本番反映の承認候補・切り戻し

1. 対象 zone `burneto.com` の Always Use HTTPS を off → on、最低 TLS を 1.0 → 1.2。
   HTTP を HTTPS に転送し、TLS 1.0/1.1 の旧クライアントは利用不可になる。
   この対象・変更・影響への明示承認後に実施し、設定の読み戻し、HTTP 転送先、TLS 1.2/1.3 と主要ブラウザを確認する。
   問題時はそれぞれ off / 1.0 へ戻す。HSTS・他 zone・DNS は変えない。
2. レビュー済み PR の確定 commit の Web 成果物だけを `burneto` に配信。
   `_headers` による frame/object/権限拒否・referrer 非送信を含めて承認する。
   現行 `Deploy Production` は Supabase job も起動するため、そのまま実行しない。
   API 側の未承認反映を含まない Web 配信経路を確定してから承認対象にする。
   本番 build は既存 Supabase・Sentry 環境値を維持し、hidden map の upload/delete 後に
   配信 assets 内の `.map` 不在と管理秘密の非混入を確認する。
   `cf deploy --prebuilt --mode production --dry-run` の同一成果物だけを配信する。
3. 反映後は active version / domain / HTTPS・ヘッダー、参照 JS/CSS の MIME・ETag・圧縮、
   `/payments` の直接アクセス・reload・旧タブからの操作を確認する。
   session を消去せず既存 session を確認し、Google → Supabase → `/auth` → `/`、
   通常 CRUD、Sentry の受信と map 解決、同条件の初回/再訪を確認する。
   OAuth token・実データは記録せず、実施結果と不足を Issue/PR に要約する。
4. 新ヘッダーによる表示・認証・通信障害なら配信を止め、配信直前に読み戻した旧 version を
   [Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) で100%へ戻す。
   上記観測時の旧 version は候補であり、実行時の最新値と置き換える。
   SSL/HTTP 設定は Worker rollback で戻らないため別々に復元・読み戻す。
   ドメインを旧 Pages へ移す手順は[移管手順](workers-migration.md)の別の復旧対象として扱う。

## 監視と残る確認

Cloudflare zone Analytics / Security Events で `burneto.com` の status・challenge/block と転送量、
Workers Metrics / account Usage で利用量と上限、Sentry で表示・Auth callback のエラーを確認する。
静的配信が Worker invocation と同じ課金・ログ経路とは限らないため、
[Static Assets の料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)と実契約を照合する。
悪化時は active version と発生時刻を照合し、上記切り戻しを判断する。
account の Notification policies API は成功し空配列だった。
account subscriptions API は認証エラーで実契約を取得できず、現使用量・残容量も未確認。
この account の通知 policy は確認できておらず、監視設定済みとは主張しない。
新しい通知先・課金・ログ収集は追加していない。

本番反映前に残る metadata は deploy token の権限・期限・環境別分離、
Free Managed の実有効状態、Workers の実契約・利用量と既存監視。
受入未確認は本番 HTTPS/ヘッダー反映、Google/既存 session/通常操作/Sentry、更新後の参照整合、前後測定。
これは Issue の既存完了条件の残りであり、別の公開基準や新しい Audit を追加するものではない。

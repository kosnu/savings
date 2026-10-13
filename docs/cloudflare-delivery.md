---
title: Cloudflare のWeb配信と運用
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
  - Web配信のセキュリティ・キャッシュ方針を確認するとき
  - Webだけを配信、確認、切り戻すとき
---

# Cloudflare のWeb配信と運用

Burneto の配信では、**画面を安全に届けることと、更新後も正しく表示できること**を両立する。
ここでは、その配信方針と運用手順を説明する。本番への反映済み状態を示す文書ではない。
本番の実設定・測定値・反映結果は [Issue #1886 の調査結果](https://github.com/kosnu/savings/issues/1886#issuecomment-6148815301)で確認する。

## 静的配信：Cloudflare が画面を届ける

React の画面を Vite で HTML・JavaScript・CSS にビルドし、Workers Static Assets で配信する。
本番は `burneto` / `burneto.com`、Dev は `burneto-dev` を使い、データ・設定を分離する。
[cloudflare.config.ts](../apps/web/cloudflare.config.ts) の SPA fallback により、`/payments` などの URL を直接開いても画面を表示できる。

認証・データ操作はブラウザから Supabase へ、エラー報告は Sentry へ直接通信する。
Worker サーバーコードや Supabase API の代理経路は持たない。
初期移管は[移管手順](workers-migration.md)、Dev は[プレビュー運用](development-preview.md)を参照する。

## 守る範囲：配信する画面と、その通信経路

静的応答にセキュリティヘッダーを付け、外部サイトへの埋め込みやファイルの誤った実行を制限する。
既存の Google ログイン、Supabase・Sentry 通信を維持する範囲で設定する。
この CSP は、実行できる script を限定して XSS を防ぐ設定ではない。

zone の WAF・Bot 対策は、Cloudflare を通る `burneto.com` の通信が対象。
直接 Supabase へ送る API、Google / Supabase callback、別ホストの `pages.dev` / `workers.dev` は、この zone の保護範囲に含めない。
ルールは現行プランの制限と正常利用への影響を確認してから判断し、Supabase 設定は変更しない。

## 更新と運用：保存したファイルも、使う前に更新を確認する

HTML と静的ファイルは `public, max-age=0, must-revalidate` を維持する。
ブラウザに保存できるが、再利用前に更新を確認する。ETag がある資源は、変更がなければ本文を送り直さずに済む。
圧縮は Cloudflare の標準機能を使う。

`/assets/*` 全体の長期保存は、SPA fallback で欠落 URL に返る HTML まで保存する恐れがある。
HTML の長期 TTL や Cache Everything は使わず、認証情報・利用者別データの共有キャッシュも設けない。
キャッシュや圧縮は、設定値だけでなく実応答で確認する。

本番変更は、対象・影響・切り戻しへの明示承認後に行う。
反映後は表示・既存 session・Google ログイン・通常操作・Sentry と、同条件の初回／再訪性能を確認する。
監視で悪化を見つけたら反映した版と時刻を照合し、以前の配信版へ戻す。
HTTPS/TLS の zone 設定は Worker の切り戻しとは別に復元する。

## 必要なときに参照する詳細

<details>
<summary>ヘッダーと不正利用対策</summary>

[Workers のヘッダー仕様](https://developers.cloudflare.com/workers/static-assets/headers/)に従い、
Vite public から assets 出力へ `_headers` をコピーする。
CSP は `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`。
外部 base URL、object 埋込、他サイトからの frame 埋込を防ぐ。
`X-Frame-Options: DENY` を併用し、`nosniff` で欠落 JS に返った HTML の script 実行を拒否する。
`Referrer-Policy: no-referrer` は callback URL 等を参照元として送らない。
未使用の camera / microphone / geolocation を Permissions-Policy で無効化する。

`default-src` / `script-src` / `style-src` / `connect-src` / `form-action` を設定しないため、
既存の inline style、Google へのトップレベル遷移、Supabase・Sentry 通信を制限しない。
COOP / COEP は OAuth popup や外部資源への影響を検証していないため追加しない。
反映後は Google ログイン、既存 session、Sentry のイベント受信・map 解決を確認する。

[Free custom rules](https://developers.cloudflare.com/waf/custom-rules/) は5件、Log action と regex は利用不可。
[rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) は Free で1件などプラン別の制約がある。
[Managed Rules](https://developers.cloudflare.com/waf/managed-rules/) では Free Managed が利用でき、
Cloudflare Managed / OWASP 全体は Free の対象外。
[Bot Fight Mode](https://developers.cloudflare.com/waf/feature-interoperability/) は Free で利用できるが、
custom rule の Skip で例外化できない。正常利用への影響を確認してから適用を判断する。
静的ファイルを一律に厳しい IP レートで制限すると、並列読込や共有 NAT を遮断し得る。
閾値は攻撃と正常利用の観測を根拠に定める。

</details>

<details>
<summary>初回・再訪の測定</summary>

同じ端末・接続・ブラウザ版、1280×720、ja-JP、throttling なし、匿名トップページで測定する。
独立 context 3個で各1回の初回と、同じ context で about:blank を経由した再訪を比べる。
service worker を無効にし、networkidle 後2秒までの Navigation/Resource Timing と
PerformanceObserver で TTFB、load、FCP、LCP、CLS、同一 origin の転送量を取得する。

リポジトリ指定の Node/pnpm で依存を導入する。次のコードを
`/tmp/burneto-delivery-measure.js` に保存し、リポジトリルートから専用の匿名 session で実行する。
ローカル依存の Playwright CLI を使うため、グローバルの `playwright-cli` は不要。

```sh
pnpm ci
pnpm --filter web exec playwright cli -s=delivery open about:blank
pnpm --filter web exec playwright cli -s=delivery run-code --filename /tmp/burneto-delivery-measure.js
pnpm --filter web exec playwright cli -s=delivery close
```

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

測定は少数の通常閲覧で行い、負荷試験には使わない。
前後の active version、日時、ブラウザ版、接続条件を記録し、3組の中央値とばらつきを比較する。
転送量は Timing API のサイズで、TLS/HTTP 全体の wire byte 数ではない。
cross-origin 通信、操作を伴う INP、実利用者 p75、認証済み画面の性能はこの測定に含まれない。
ローカル配信と本番の差を改善効果として扱わず、同条件の本番前後で比較する。
生出力・URL query・cookie・storage・trace は保存せず、結果の要約と限界を Issue に記載する。
測定用コードと専用 session の一時出力は確認後に削除する。既存のブラウザ session は消去しない。

</details>

<details>
<summary>Web だけの本番配信と切り戻し</summary>

承認対象は commit・Worker/zone・変更内容・影響・切り戻し。
HTTPS 転送・最低 TLS は zone の設定で、Worker 配信とは別に適用・読み戻す。
HSTS の長期 max-age / includeSubDomains / preload は、復旧時の影響も含めて別途判断する。

Web だけを反映するときは、承認した commit の専用 checkout と既存の本番用環境設定を使う。
既存 `Deploy Production` は Supabase job も起動するため、Web 専用の反映には実行しない。
必要な入力は Web の Supabase 公開設定、Sentry build 設定、Cloudflare の account と deploy token。
secret 値を記録やコマンド文字列へ転載しない。本番と Dev の値を混在させない。

```sh
pnpm ci
pnpm run web:build
pnpm --filter web exec cf deploy --prebuilt --mode production --dry-run
# 明示承認後に、検証した同一成果物だけを配信する。
pnpm --filter web exec cf deploy --prebuilt --mode production
```

build は本番 Sentry の hidden map を upload/delete し、配信 assets 内の `.map` 不在と管理秘密の非混入を確認する。
合成設定の検証成果物を本番へ使わず、本番設定で一度ビルドした `.cloudflare/output/v0/` を再ビルドせずに配信する。
Supabase CLI・DB migration・Auth 設定の変更はこの経路に含まれない。

反映後は active version / domain、HTTPS とヘッダー、参照 JS/CSS の MIME・ETag・`Content-Encoding` を読み戻す。
HTML の実応答と zone の browser cache TTL は別に確認し、index.html の参照先が存在することも確かめる。
`/payments` の直接アクセス・reload・旧タブからの操作、session を消去しない既存 session、
Google → Supabase → `/auth` → `/`、通常 CRUD、Sentry の受信・map 解決と同条件の前後性能を確認する。
map URL は SPA fallback で HTML 200 を返し得るため、status だけで公開 map の有無を判定しない。
実施結果と不足は対象 Issue/PR に要約する。

障害時は配信を止め、配信直前に確認した旧 version を
[Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) で100%へ戻す。
Dashboard の Workers & Pages → `burneto` → Deployments から対象旧 version の Rollback を選び、
表示・直接アクセス・既存 session・認証を再確認する。DB / Auth / 利用者データを戻す操作は含めない。
zone の HTTPS/TLS 設定は、変更前の値へ別途復元して読み戻す。
旧 Pages の削除・ドメイン移管はこの配信に含めず、Pages への復旧は[移管手順](workers-migration.md)を参照する。

</details>

<details>
<summary>監視と使用量の確認</summary>

zone Analytics / Security Events で `burneto.com` の HTTP status・challenge/block・転送量、
Workers Metrics / account Usage で利用量と上限、Sentry で表示・Auth callback のエラーを確認する。
悪化時は active version と発生時刻を照合し、上記の切り戻しを判断する。

[Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) の invocation と
静的配信の全 HTTP traffic・課金 quota は同じではない。空行を利用ゼロや残容量の証明にしない。
`usage_model` や zone plan だけで Workers の実契約を確定せず、
[Static Assets の料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)と実契約を照合する。
通知設定・使用量を取得できない場合は未確認として記録し、監視設定済みとは扱わない。

</details>

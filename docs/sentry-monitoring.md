---
title: Sentry のエラー監視と運用
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - apps/web/src/lib/sentry.ts
  - apps/web/src/lib/sentryPrivacy.ts
  - apps/web/vite.config.ts
topics:
  - sentry
  - privacy
  - monitoring
when_to_read:
  - Sentry の収集範囲や障害調査を変更するとき
  - Sentry の受信・source map・使用量・通知を確認するとき
---

# Sentry のエラー監視と運用

障害の分類と、配信したJavaScriptの発生位置を調べるためにSentryを使う。
診断に必要な情報だけを送り、認証情報・個人情報・支払い明細を収集しない。
具体的な収集条件と許可項目は[SDK初期化](../apps/web/src/lib/sentry.ts)と
[送信前処理](../apps/web/src/lib/sentryPrivacy.ts)を正本とする。

## 調査できる範囲と限界

診断情報を許可集合から構成し、未知の機微語を正規表現で探す方法に依存しない。
自由文や操作履歴は送らないため、詳細な操作の再現や未知の障害の細分類には限界がある。
監視対象を広げるときは、診断への効果とプライバシー・通信量・使用量の増加を評価する。

送信失敗や使用量制限でイベントが欠落することがある。受信がないことだけで正常と判断しない。
監視の成功を業務操作の完了条件にせず、監視APIの失敗をログイン・支払い・予算操作へ伝播させない。

## 配信成果物と障害を対応付ける

releaseはビルド対象のコミットSHAとし、配信workflowからビルドへ渡す。
同じコミットを複数環境で使う場合はenvironmentで区別し、受信event IDと配信SHAを照合する。
ソース位置は、配信したJavaScriptと同じDebug IDを持つsource mapから解決する。
アップロード成功だけで、実際の受信やソース位置の解決まで成功したとは扱わない。

環境間でprojectを共用する場合、収集設定・通知・使用量枠も共有される。
environmentは分類用の値であり、権限や外部設定の影響を分離する境界にはならない。

## 変更時に確認すること

外部設定の変更・配信・試験送信は、対象、送信内容、通知先と使用量への影響、停止条件、
復旧方法を示して承認を得る。確認には合成データを使い、秘密値や実利用者の情報を記録しない。

変更に関係する範囲を次の方法で確認し、対象SHA・結果・未確認事項はIssueまたはPRに残す。

1. 採用する収集方針と、実際のデータ除去・PII・管理権限とMFA・tokenの権限と期限・保存期間・使用量制限を照合する。
2. 合成の認証エラー・予算エラー・未処理例外について、ブラウザの送信内容と受信event IDを照合する。
   機微情報の除去、必要な分類情報の保持、source mapでの発生位置、承認済み通知先への到達を確認する。
3. 公開成果物にsource mapと管理tokenがないこと、アップロード・削除の失敗時に公開される範囲を確認する。
4. 実送信を遮断した隔離環境で、送信失敗・offline・上限応答を再現し、業務操作が継続することを確認する。
5. 同じブラウザ・CPU・通信・cache・合成データ・操作回数で変更前後を比較する。
   転送量・初回表示・通常操作の負荷・送信件数を複数回測り、中央値とばらつきを確認する。

ローカルのmockやテストtransportによる確認は、外部サービスでの受信・通知・位置解決の代替にはしない。

## 切り戻し

SDKは検証済みの成果物へ戻す。機微情報の除去が弱まる旧版への復旧は、その影響も判断する。
外部設定は変更前に確認した値へ、対象項目だけを戻す。復旧値を推測しない。
切り戻しても、既に受信したイベントや送信済みの通知は取り消せない。

## 配信設定の参照

- [Vite連携](../apps/web/vite.config.ts)：source mapの生成・アップロード・削除。
- [Dev配信workflow](../.github/workflows/deploy_preview.yaml)と[本番配信workflow](../.github/workflows/deploy_production.yaml)：ビルド対象とreleaseの受け渡し。
- [Devプレビュー運用](development-preview.md)：EnvironmentのSecret登録と配信手順。

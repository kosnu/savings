---
title: 本番リリースの再実行と障害復旧
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - .github/workflows/draft_production_release.yaml
  - .github/workflows/release_production.yaml
  - .github/workflows/deploy_production.yaml
  - tools/production-release
topics:
  - release
  - recovery
  - supabase
  - cloudflare
when_to_read:
  - 本番配信の失敗や障害に対処するとき
  - 公開済みReleaseを再配信するとき
---

# 本番リリースの再実行と障害復旧

[通常のリリース手順](production-release.md)で配信に失敗した場合や、配信後に障害が発生した場合に使う。

## 最初に確認すること

Release・SHA・成功済みの範囲・実反映を確認する。
結果欄がない・古い場合は、Actions の受付／配信 run・各 job・attempt・summary を調べる。

- 通信エラーで成否不明なら、実状態を調べてから判断する。公開や配信を重ねて起動しない。
- 新しい版の配信後に古い run を再実行して戻さない。

## 状態に応じた対応

- **公開受付・事前検証に失敗：** タグ・SHA を確認する。不正な対象はタグを付け替えず、修正した新 Release を準備する。
  一時的な API 障害なら、同じ受付を再実行できる。
- **DB 失敗：** Web は未配信。migration 履歴・ログから部分適用とデータへの影響を調べ、安全に再適用できる場合だけ再実行する。
- **DB 成功、Web 失敗：** Worker の active version を確認する。新 DB と旧 Web の互換性を維持して、同じ Release を再実行する。
- **Web 配信後の障害：** 新 DB と互換な場合に限り、[Web 切り戻し](cloudflare-delivery.md#必要なときに参照する詳細)で旧 Worker version へ戻す。
  DB・Auth・データは戻らない。
- **DB 復旧が必要：** 自動 down migration は行わず、原則は修正 migration を含む新 Release で前進復旧する。
  データ復元は、実在するバックアップ・復元時点・停止／損失範囲を確認して行う。
- **結果欄だけ更新失敗：** DB/Web の job と実反映を確認し、report job のみ再実行する。DB/Web の再配信は不要。

## 同じ Release を再実行する

公開・再実行は一件ずつ行い、前の配信と確認が終わるまで次を開始しない。
通常は **Deploy Production → Re-run all jobs** を使う。
失敗 job だけの再実行も Release を再検証する。Web のみの再実行は同じ Release の DB 成功が確認できる場合に限る。

適用済み migration は履歴でスキップする。
複数 migration 全体の rollback、失敗 SQL の副作用解消やデータ復元は保証しない。

再実行可能期間の経過・workflow 修正後は、**Deploy Production** を `main` から手動実行し、次の入力を指定する。

| 入力           | 指定する値                                 |
| -------------- | ------------------------------------------ |
| `release_id`   | Release API で確認した ID                  |
| `expected_sha` | タグの commit・元 run で確認した完全な SHA |

この手動実行は公開済み正式版の再配信専用で、任意の ref は指定できない。
Release の削除・Draft 化・タグ移動は、本番の取り消しや DB 復元にならない。

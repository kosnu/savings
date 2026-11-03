---
name: release
description: Prepare, publish, and verify production releases for kosnu/savings, including Draft preparation and deployment recovery. Explanation-only requests authorize no execution.
---

# Release

依頼された範囲で本番リリースを進め、候補または配信結果と未確認事項を報告する。

## 入口

- 以下のパスは checkout のルート相対。`AGENTS.md`、`docs/harness/rule-map.json`、`docs/harness/policies/git-workflow.md` を適用し、
  正本 `docs/production-release.md` と今回必要な確認・復旧の参照先を読む。採番・操作・復旧手順を本スキルで再定義しない。
- checkout と GitHub の対象が `kosnu/savings` で、必要な workflow が **GitHub 上の main** に導入済みか確認する。
  未導入なら必要な PR と不足を示す。リリース依頼を PR の merge・workflow 改修・Secret や保護設定の変更へ広げない。
- 接続済み GitHub ツールを優先し、不足する操作には既存認証の `gh` または GitHub UI を使う。

## 実行時の判断

1. 会話から説明・候補確認・Draft 準備・公開・復旧の依頼範囲を確定する。説明・確認は読み取りで終える。
   対象 Release ID・タグ・完全な SHA・変更一覧・CI と、進行中の準備／配信 run を実データで確認する。
2. 準備が依頼されていれば手順書に従う。ユーザー指定のタグ・SHA・変更範囲を最新 main へ置き換えない。
   指定 SHA が最新 main と異なる場合は、手順書の手動 Draft 準備を使う。
3. 公開が依頼された場合だけ、具体的な候補・影響・復旧方法への承認を照合する。既存の有効な承認は取り直さない。
   不足なら候補を整えてから承認を求める。スキル呼び出し・Draft 準備・番号の承認は公開承認にしない。
   公開直前に対象と CI を再取得し、候補の変更は差分を示して変更対象への承認を確認する。
4. 実行中の run を追跡し、同じ準備・公開・配信を重ねて起動しない。成否不明なら実状態を先に確認する。
   host の識別子と待機手段を使い、承認待ち・失敗・確認不能を成功として扱わない。
5. 公開後は Release ID・SHA に対応する run、DB/Web の成否、結果欄、実反映を手順書に従って照合する。
   workflow の main SHA と配信対象 SHA を区別する。失敗時の対処も手順書と既存承認の範囲に限る。

Release URL・タグ・対象 SHA・配信 run・DB/Web と実機確認の結果を短く報告する。
候補確認・準備のみの依頼はその範囲で終え、公開済み・反映済みと報告しない。

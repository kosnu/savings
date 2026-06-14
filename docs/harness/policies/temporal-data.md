---
title: Temporal Data Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - apps/web
  - apps/api
  - apps/api/supabase/migrations
topics:
  - temporal-data
  - history
  - effective-date
  - deletion
  - timezone
  - database
when_to_read:
  - 有効開始日、有効期間、履歴、月次状態を扱うDB設計を変更するとき
  - 最新レコード、削除、無効化、復活挙動を含む仕様を整理するとき
  - Requirements / PRDやDesign Docで過去表示と現在有効状態の境界を決めるとき
  - ユーザー操作の対象月や対象日をWeb、API、DBのどこで決めるかを整理するとき
---

# Temporal Data Policy

有効開始日や履歴を持つデータでは、「現在有効な状態」と「過去時点で閲覧すべき履歴」を分けて扱います。

最新レコードを削除した結果、過去レコードが暗黙に再有効化される設計は、ユーザーが現在以降を「なし」にしたい意図と矛盾しやすいため、原則として避けます。

## 基本ルール

- `effect_from` などの開始日だけで現在有効な状態を決める場合、最新行の削除時に過去状態が復活しないか確認する。
- 「なし」「無効」「終了」「削除済み」がユーザーに意味を持つ場合は、物理削除だけで表現しない。
- 現在有効な状態を消す操作は、必要に応じて `status`、`ended_at`、`disabled_at`、marker row、event などで明示する。
- 過去時点の閲覧では、その時点で有効だった値を表示できるようにする。
- 当月や未来に対する更新が、過去月の表示を上書きしないことを受け入れ条件に含める。
- ユーザー操作の対象月や対象日がUIの選択、ローカル日付、表示中の集計期間に依存する場合、DBやRPCは `current_date` などのDBサーバー時刻で対象期間を補完しない。Webからdate-onlyの対象日または対象月を明示的に渡し、read / writeで同じ基準日を使う。

## Requirements / PRDで書くこと

期間や履歴が関わる要求では、次を明示します。

- 基準日
- 現在有効な状態
- 過去時点で表示する状態
- 削除、無効化、終了後の状態
- 登録、更新、削除を許可する対象月や対象期間
- Web、API、DBのどの層が対象月や対象日を決めるか
- 過去表示を壊してはいけない受け入れ条件

月次状態を扱う場合は、当月、過去月、未来月を含む具体例を置きます。

## Design / Planで決めること

Design / Planでは、少なくとも次の選択肢を比較します。

- status列で状態を持つ
- 終端日を持つ
- 状態変更イベントとして積む
- 現在状態と履歴を別テーブルに分ける
- RPCやdatabase functionで操作単位を閉じる

採用案では、削除や無効化の操作後に過去レコードが暗黙に復活しない理由を説明します。

ユーザー操作の対象期間を扱う採用案では、read側とwrite側が同じ基準日を使う理由を説明します。DBサーバー時刻を使う場合は、ユーザーのローカル日付や表示中の対象月とずれても要件を満たす理由を明示します。

## Migration Review Checklist

次に該当する migration を追加または変更するときは、レビューで確認します。

- `effect_from`、`valid_from`、`started_at` などの開始日で有効状態を表す
- 最新行を `order by ... desc limit 1` などで選ぶ
- 履歴、月次設定、予算、状態、設定値を扱う
- delete policy や物理削除のユーザー操作を追加する
- RPCやdatabase function内で `current_date`、`now()`、`clock_timestamp()` などから対象日や対象月を決める

確認観点:

- 最新行を消したとき、過去行が現在有効として復活しないか
- 「なし」を表現すべき要求が物理削除だけに押し込まれていないか
- 過去月や過去時点の表示が現在の更新で変わらないか
- RLS、RPC、UI操作が同じ有効状態の境界を見ているか
- 取得、作成、更新、削除が同じ対象月や対象日を基準にしているか

この確認は、現時点では機械的な linter ではなく migration review checklist として扱います。構文だけではプロダクト上の「なし」と「削除」の意味を判定しにくいためです。

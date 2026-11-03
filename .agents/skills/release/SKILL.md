---
name: release
description: Prepare, publish, and verify production releases for kosnu/savings using its release runbook. Use for release operations, including draft preparation and deployment recovery; explanation-only requests authorize no execution.
---

# Release

`kosnu/savings` の本番リリースを、候補確認・必要な準備・承認済みの公開・反映確認まで進める。
番号の基準、公開方法、DB を含む復旧の正本はリポジトリの手順書とする。

## 対象と現在の手順を読む

以下のパスはこのリポジトリの checkout のルート相対で読む。スキルの配置ディレクトリを基準に解決しない。

- `AGENTS.md`、`docs/harness/rule-map.json`、`docs/harness/policies/git-workflow.md` を適用する。
- `docs/production-release.md` を読み、今回使う workflow と接続先の確認・復旧手順を必要な範囲で読む。
- checkout と GitHub の対象が `kosnu/savings` であることを確認する。特定の worktree の絶対パスへ固定しない。
- main に目的の workflow が導入済みかを GitHub 上で確認する。作業ブランチにファイルがあることを導入済みの証拠にしない。
  未導入なら必要な PR と不足を示す。リリース依頼だけで PR の merge や workflow の改修を行わない。

接続済み GitHub ツールを優先し、不足する操作には既存認証の `gh` または GitHub UI を使う。
リリースのためだけに Secret、Environment の保護、OAuth、課金設定を変更しない。

## 候補を確認・準備する

1. 依頼が説明、候補の確認、Draft の準備、公開、再実行・復旧のどれかを既存の会話と照合する。
   説明・確認だけなら読み取りで終え、Draft 更新・公開・配信を開始しない。
2. 前回正式版、対象 Draft の ID・タグ・完全な SHA・変更一覧、関連 PR と対象 commit の CI、
   進行中・待機中の準備／配信 run を取得する。CI の未完了・失敗・キャンセルを成功としない。
3. 準備が依頼範囲に含まれ、候補がない・古い場合は、手順書の Draft 準備 workflow を main から一度だけ実行する。
   自動準備の途中に同じ処理を重ねず、実行中ならその run を追跡する。
   番号の手動補正や安定版への移行は、手順書の基準と明示された依頼に従う。
   ユーザー指定のタグ・SHA・変更範囲を最新 main へ読み替えない。
   指定 SHA が最新 main と異なる場合は、自動準備を起動せず手順書の手動 Draft 準備でその SHA を維持する。
   その候補を自動更新から区別し、進行中の準備 run と衝突しないことを確認する。
4. 自動提案を変更全体と採番基準で照合する。DB migration があれば、適用差分・旧 Web との互換性・
   失敗時の状態と復旧可能な範囲を確認する。担当者の追記は手順書が定める自動生成範囲の外へ残す。

公開も依頼された場合は、公開前に Release の ID・タグ・完全な SHA・変更内容・本番への影響・復旧方針を具体的に提示する。
これらに対応する公開への承認が既存会話にあれば引き継ぎ、不足する場合だけその候補への承認を求める。
スキルの呼び出し、Draft 作成の依頼、番号だけの承認を本番公開の承認に読み替えない。

## 承認された対象を公開・確認する

- 公開直前に Draft を再取得し、ID・タグ・SHA・内容が承認対象と一致し、必要な CI が成功していることを確認する。
  候補が変わった場合は差分を提示して変更された対象の承認を得る。同じ対象への有効な承認は取り直さない。
- 手順書の方法と実行権限に従い、プレリリースでない正式版として一度だけ公開する。
  workflow の `GITHUB_TOKEN` による公開はイベントを起動しないため使わない。
  公開を確認した後、同じ配信を手動 dispatch して二重起動しない。
- Release ID と対象 SHA に対応する公開受付・本番配信 run を特定し、host が返した識別子と待機手段で終了まで追跡する。
  Environment の承認待ちは配信成功とせず、ユーザーに必要な操作と対象 run を示す。
- DB と Web の両 job、Release の結果欄、反映先の状態を照合する。main 上の workflow の SHA と配信対象 SHA を混同しない。
  表示・既存 session・ログイン・通常操作・監視の確認は手順書の範囲で実施し、観測できなければ未確認として残す。

## 失敗・再実行と終了

通信エラーで公開・配信の成否が不明なら、Release と run の実状態を先に確認し、同じ mutation を自動再送しない。
失敗時は成功した範囲、DB の適用状態、Web の active version を確認し、手順書と既存承認の範囲で再実行・復旧する。
新しい版の配信後に古い run を再実行して戻さず、DB の自動巻き戻しや未承認のデータ復元を行わない。

最後に Release URL・タグ・対象 SHA・配信 run・DB/Web の成否・実機確認と未確認事項を短く報告する。
候補準備までの依頼は、その範囲で終了する。待機・失敗・確認不能を公開済み・本番反映済みと報告しない。

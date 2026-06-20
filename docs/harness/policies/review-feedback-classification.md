---
title: Review Feedback Classification
doc_type: policy
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - review
  - pull-request
  - ai-driven-development
  - requirements
  - design
  - verification
when_to_read:
  - PRレビューコメントに対応するとき
  - 未解決review threadを確認するとき
  - レビューコメントをShip、learn skill、Build / Verify工程内の整合性問題に分類するとき
---

# Review Feedback Classification

PRレビューコメントに対応するときは、最初に分類します。

Build / Verify完了後の成果物フィードバックを前回実装への局所修正として扱うと、次回Requirementsの入力にすべき仕様判断や設計判断を小修正として吸収してしまい、PRDやDesign Docとの接続が崩れます。

## 分類

- Build / Verify工程内の整合性問題: Build / Verify実行中に見つかったテスト失敗、型、lint、実装整合性、変更漏れ、呼び出し側調整、検証で見つかった未整合
- Ship: PR本文、検証結果の記載、レビュー返信、thread resolve、残リスクの説明など提出物の不備に関わるコメント
- Learn skill: Build / Verify完了後の成果物フィードバック、レビューコメント、検証結果、運用知見、ルール、ポリシーに関わるコメント

## 対応ルール

- Build / Verify工程内の整合性問題は、Build / Verifyが完了するまで工程内で修正し、要件未達を残さない。
- Build / Verify完了後の成果物フィードバックは、実装成果物への指摘であってもその場で実装修正せず、Learn skillで次回Requirementsの初期Input、ルール、ポリシー、監督制約に整理する。
- Ship のコメントは、差分の事実、検証結果、返信内容、resolve可否が確認できる範囲で対応する。
- 複数分類にまたがるコメントは、Learn skillを優先する。
- 分類が曖昧な場合は、実装修正せず、何が未決かを明示する。
- Learn skillに送るコメントを扱うときは、前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断を次回Requirements / Designの根拠にしない。

## 返信ルール

対応済みコメントへ返信するときは、次を簡潔に書きます。

- どの分類として扱ったか
- 何を変更したか、またはなぜ変更しなかったか
- 対応 commit がある場合は commit ID
- 検証した内容

PRコメント内の commit ID はバッククォートで囲みません。

## Stop条件

次に該当する場合は、Build / Verify工程内の整合性問題として修正しません。

- Build / Verify完了後の成果物フィードバックである
- 前回実装への局所修正として扱う必要がある
- PRDの受け入れ条件を変える必要がある
- Design Docの採用方針を変える必要がある
- DB / API / 認証 / 権限モデルの変更が新たに必要になる
- policyや恒久ドキュメントへ整理すべき横断ルールが含まれる
- review threadをresolveすると未解決の仕様判断を隠すおそれがある

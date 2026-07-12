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

PRレビューコメントに対応するときは、最初にタスク種別を判定してからコメントを分類します。

- AI Driven Developmentサイクル: Requirements / PRDとDesign Docを入力に、Build / Verify、Shipまでの工程を進めるタスク
- 通常タスク: 現在のタスクに関する既存のRequirements / PRDやDesign Docを入力にせず、現在のIssueや依頼を直接実行する軽微修正、ドキュメント変更、レビュー修正など

AI Driven Developmentサイクルでは、Build / Verify完了後の成果物フィードバックを前回実装への局所修正として扱うと、次回Requirementsの入力にすべき仕様判断や設計判断を小修正として吸収してしまい、PRDやDesign Docとの接続が崩れます。この制約を通常タスクへ適用しません。

## 分類

- Build / Verify工程内の整合性問題: Build / Verify実行中に見つかったテスト失敗、型、lint、実装整合性、変更漏れ、呼び出し側調整、検証で見つかった未整合
- Ship: PR本文、検証結果の記載、レビュー返信、thread resolve、残リスクの説明など提出物の不備に関わるコメント
- learn skill: AI Driven DevelopmentサイクルのBuild / Verify完了後に得た成果物フィードバック、レビューコメント、検証結果、運用知見、ルール、ポリシーに関わるコメント
- 通常タスク内の修正候補: 現在のIssueや依頼の範囲で、実装、テスト、ドキュメント、設定などの修正要否を判断できるコメント

## 対応ルール

- Build / Verify工程内の整合性問題は、Build / Verifyが完了するまで工程内で修正し、要件未達を残さない。
- AI Driven DevelopmentサイクルのBuild / Verify完了後の成果物フィードバックは、実装成果物への指摘であってもその場で実装修正せず、learn skillで次回Requirementsの初期Input（Issue内容）、ルール、ポリシー、監督制約に整理する。
- 通常タスクのレビューコメントは、指摘の妥当性、現在のスコープとの関係、修正の必要性を確認する。必要な修正は現在のタスクまたはPR内で実施して検証し、修正不要と判断したコメントには理由を示す。
- Ship のコメントは、差分の事実、検証結果、返信内容、resolve可否が確認できる範囲で対応する。
- AI Driven Developmentサイクルで複数分類にまたがるコメントは、learn skillを優先する。
- 通常タスクで分類が曖昧な場合は、修正要否を判断するために不足している情報を明示する。意図、スコープ、成功条件を変えずに判断できる場合はStopしない。
- learn skillに送るコメントを扱うときは、前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断を次回Requirements / Designの根拠にしない。

## 返信ルール

対応済みコメントへ返信するときは、次を簡潔に書きます。

- どの分類として扱ったか
- 何を変更したか、またはなぜ変更しなかったか
- 対応 commit がある場合は commit ID
- 検証した内容

PRコメント内の commit ID はバッククォートで囲みません。

## Stop条件

AI Driven Developmentサイクルで次に該当する場合は、Build / Verify工程内の整合性問題として修正しません。

- Build / Verify完了後の成果物フィードバックである
- 前回実装への局所修正として扱う必要がある
- PRDの受け入れ条件を変える必要がある
- Design Docの採用方針を変える必要がある
- DB / API / 認証 / 権限モデルの変更が新たに必要になる
- policyや恒久ドキュメントへ整理すべき横断ルールが含まれる
- review threadをresolveすると未解決の仕様判断を隠すおそれがある

通常タスクでは、レビューコメントへの対応により意図、受け入れ条件、変更スコープ、リスク、検証方針を現在のタスクから大きく変える必要がある場合にStopします。Build / Verify完了後であることや、前回実装への局所修正であることだけをStop理由にしません。

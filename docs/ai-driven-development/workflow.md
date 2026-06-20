---
title: AI Driven Development Workflow
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - workflow
  - prd
  - design-doc
  - pull-request
when_to_read:
  - AI駆動開発の工程を選ぶとき
  - Codex GoalをPRD、Design Doc、実装、提出準備、学習整理に分けるとき
  - Shipとlearn skillの役割を確認するとき
---

# AI Driven Development Workflow

このリポジトリでは、AI駆動開発のGoalを次の4工程に分けます。

1. Intent / Requirements Goal
2. Design / Plan Goal
3. Build / Verify Goal
4. Ship Goal

Build / Verifyは、Requirements / PRDとDesign Docを満たす実装と検証を完了する工程です。正常終了時に要件未達は残しません。Requirements / PRDまたはDesign Docが不足・矛盾して満たせない場合は、解釈で埋めずStop条件として扱います。

Shipは、Build / Verify済みの成果をPR、説明、レビュー返信ができる形へ整える工程です。要件充足の一次確認はBuild / Verifyで完了している前提にします。

LearnはGoalではなくskillです。レビューコメント、検証結果、運用知見、ルール・ポリシー変更を、次回のRequirements入力、ルール、ポリシー、監督制約へ整理します。次回のサイクルを回す場合は、前回の続きとして途中工程から再開せず、`$learn` で入力を整理してから、必ずIntent / Requirements Goalから始めます。

このフローはHuman on the loopを前提にします。AIはStop条件に当たらない限り次工程へ進み、人間は各工程の逐次承認ではなく、リスク監督、例外処理、最終的な公開可否を担います。

起点になるIssueは、Requirements / PRDの入力です。Issueには意図、境界、成功条件、Stop条件を書き、実装方針や作業手順はDesign / Plan Goalへ寄せます。詳細は [issue-guidelines.md](./issue-guidelines.md) を参照します。

## Harness Context

各Goalでは、作業対象を `path`, `domain`, `activity`, `topic` に分類し、[../harness/rule-map.json](../harness/rule-map.json) から読むべき文書サブグラフを選びます。

Goal本文には、選んだ関連ドキュメントと、選択理由を入力として含めます。すべての `docs/` を読むのではなく、`depends_on` で追加される前提文書を含む最小のサブグラフだけを参照します。

各工程の完了時には、選択した文書サブグラフを使って、その工程の成果物、判断、差分、検証結果がルール・ポリシーに違反していないかを確認します。違反または違反の可能性がある場合、その工程は完了扱いにせず、工程内で解消できないものはStop条件として扱います。

## Context Packet

非自明なGoalでは、本文に長い調査メモやドキュメント本文をコピーせず、実行開始時の入力をContext Packetに圧縮します。

Context Packetは、Goal実行者が最初に読むべき最小の作業文脈です。広い探索を始める前に、決定的に絞れる情報は `rule-map.json`、front matter、path、Issue / PR番号、`rg` などで候補化します。必要な場合だけ、低コストの探索用サブエージェントに候補の確認や要約を任せます。

Context Packetには次だけを含めます。

- Scope: 対象成果物、対象外、変更してよい範囲。
- Selected refs: 読むべきファイル、rule-map ID、選択理由。
- Constraints: Issue、PRD、Design Doc、policy、domain ruleから来る制約。
- Known risks: 既知の不確実性、影響範囲、検証上の注意。
- Stop checks: 実行者が止まるべき条件。
- Verification expectations: 該当する検証の種類。コマンド全文は同じリポジトリ指示を読める場合は重複させません。

実行者はContext Packetから開始し、引用されたファイルだけを読むことを基本にします。Packetが不足、矛盾、またはStop条件を示す場合だけ、追加探索または人間への確認に進みます。

## 1. Intent / Requirements Goal

何を作るかを定義します。

この段階では、実装手順に寄せすぎません。人間は必要に応じて「意図」「対象ユーザー」「成功条件」「制約」「未決事項」を渡し、AIは既存仕様、コード、ドキュメント、Issueを調査してRequirements / PRDを作成します。

主な成果物:

- 背景と課題
- 対象ユーザーと利用シーン
- ユーザーストーリー
- スコープ内 / 外
- 機能要件
- 非機能要件と制約
- 受け入れ条件
- Q&Aログ
- 技術的考慮事項

完了時チェック:

- Issue、Oversight Inputs、選択したrule-mapサブグラフから、要求、制約、対象外、受け入れ条件が逸脱していないか確認する。
- Requirements / PRD内のRule Selectionが、成果物内の判断と矛盾していないか確認する。

止まる条件:

- 要件の意図が複数解釈できる
- 対象ユーザーや成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要そう

## 2. Design / Plan Goal

どう作るかを定義します。

最新のRequirements / PRDをもとに、AIが既存実装を調査し、実装方針、影響範囲、テスト方針、リスクを整理します。ここでもまだ実装しません。

主な成果物:

- 変更対象ファイル・モジュール
- 採用する実装方針
- 採用しない案と理由
- 既存挙動への影響
- 受け入れ条件と対応するテスト方針
- リスクと確認事項

完了時チェック:

- Requirements / PRD、選択したrule-mapサブグラフ、Design Docの実装判断が矛盾していないか確認する。
- Design / Planで追加した実装方針、テスト方針、文言、操作境界がルール・ポリシーに違反していないか確認する。

止まる条件:

- 実装方針がプロダクト判断を含む
- PRDの受け入れ条件が曖昧
- 影響範囲が想定より広い
- DB / API / 認証 / 権限変更が必要

## 3. Build / Verify Goal

最新のDesign Docに従って実装し、検証まで完了します。

この段階では、AIに既存パターンに沿った実装判断、必要なテスト追加、小さな型修正や呼び出し側調整を任せます。一方で、新規依存、DB変更、API仕様変更、破壊的git操作が必要になった場合はStop条件としてエスカレーションします。

Build / Verifyは、Requirements / PRDとDesign Docを満たすまで実装と検証を行う工程です。正常終了時に要件未達は残しません。検証で未達が見つかった場合はこの工程内で修正して再検証します。Requirements / PRDまたはDesign Docの不足・矛盾で満たせない場合は、勝手に仕様を補わずStopします。

主な成果物:

- 実装差分
- 追加・更新されたテスト
- 検証結果

完了時チェック:

- Requirements / PRD、Design Doc、選択したrule-mapサブグラフ、実装差分、検証結果が矛盾していないか確認する。
- ルール・ポリシー違反または違反の可能性がある場合、Build / Verifyは完了扱いにせず、この工程内で修正またはStopする。

止まる条件:

- Design Docと違う実装が必要
- スコープ外の変更が必要
- 受け入れ条件に矛盾がある
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要
- 検証失敗が今回の変更と無関係

## 4. Ship Goal

Build / Verify済みの成果を提出できる形に整えます。

この工程は、PR作成、変更内容の要約、検証結果の記録、対応済みレビューコメントへの返信、完了済みthreadのresolveを扱います。Requirements / PRDやDesign Docの判断を作り直したり、次回の入力を整理したりしません。

主な成果物:

- PR本文
- 変更内容の要約
- PRD / Design Doc / 実装差分 / 検証結果の接続
- 受け入れ条件との対応
- 未確認事項・残リスク

完了時チェック:

- PR本文、変更要約、検証結果、レビュー返信、thread resolve判断が、Build / Verify済み成果と選択したrule-mapサブグラフに違反していないか確認する。
- Shipで要件充足判断、仕様判断、次回Requirements入力の作成をしていないか確認する。

止まる条件:

- 未解決の仕様判断が残っている
- 検証が未完了
- 差分にスコープ外変更が混じっている
- PR作成先、対象ブランチ、関連Issueが曖昧
- レビューコメントの対応が現在の差分やcommitに明確に紐づかない
- review threadをresolveすると未解決の追従作業や確認事項を隠すおそれがある

## Learn Skill

レビューコメント、検証結果、運用知見、ルール・ポリシー変更を次回のAI実行単位の入力へ整理します。

LearnはGoalではないため、Goalを設定せず、実装もしません。次回Requirementsの初期Input、関連ルール、ポリシー、監督制約を更新または参照できる形にします。前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断は、次回Requirements / Designの入力にしません。

workflow上の責務定義、工程上の位置づけ、禁止事項はこのセクションを正本とします。`$learn` の実行手順は、この責務定義に従います。

主な成果物:

- 次回Requirementsへ渡す初期Input
- 次回に参照するレビューコメント、検証結果、監督制約
- 更新または参照するルール・ポリシー
- 次回に含めない学習項目と理由

完了時チェック:

- 次回Requirements入力、参照するルール・ポリシー、監督制約が、選択したrule-mapサブグラフとLearnの禁止事項に違反していないか確認する。
- 前回実装コード、前回UI挙動、現在diff形状、前回実装由来の設計判断を入力化していないか確認する。

止まる条件:

- 次回Requirementsへ渡すべき入力が分類できない
- ルール・ポリシー更新が必要だが、更新対象が曖昧
- 前回実装を根拠にしないと入力を説明できない
- memory更新が必要だがユーザーの明示依頼がない

## 小さな変更では省略する

すべての変更を4工程に分ける必要はありません。

typo修正、軽微なログ追加、1文で差分を説明できる小さな変更は、PRDやDesign Docを独立Goalにしなくてよいです。

逆に、複数ファイルにまたがる変更、仕様判断を含む変更、初見の領域を触る変更、検証方法が重要な変更では、探索と計画を実装から分離します。

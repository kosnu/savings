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
  - Codex GoalをPRD、Design Doc、実装、出荷判断に分けるとき
  - 4工程目の役割を確認するとき
---

# AI Driven Development Workflow

このリポジトリでは、AI駆動開発のGoalを次の4工程に分けます。

1. Intent / Requirements Goal
2. Design / Plan Goal
3. Build / Verify Goal
4. Ship / Learn Goal

4工程目は、PRを作るだけでも、ナレッジを更新するだけでもありません。

AIが行った作業を出荷判断できる形に整え、必要な学習を次回以降のAI実行単位へ渡す工程です。

このフローはHuman on the loopを前提にします。AIはStop条件に当たらない限り次工程へ進み、人間は各工程の逐次承認ではなく、リスク監督、例外処理、最終的な出荷判断を担います。

起点になるIssueは、Requirements / PRDの入力です。Issueには意図、境界、成功条件、Stop条件を書き、実装方針や作業手順はDesign / Plan Goalへ寄せます。詳細は [issue-guidelines.md](./issue-guidelines.md) を参照します。

## Harness Context

各Goalでは、作業対象を `path`, `domain`, `activity`, `topic` に分類し、[../harness/rule-map.json](../harness/rule-map.json) から読むべき文書サブグラフを選びます。

Goal本文には、選んだ関連ドキュメントと、選択理由を入力として含めます。すべての `docs/` を読むのではなく、`depends_on` で追加される前提文書を含む最小のサブグラフだけを参照します。

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

止まる条件:

- 実装方針がプロダクト判断を含む
- PRDの受け入れ条件が曖昧
- 影響範囲が想定より広い
- DB / API / 認証 / 権限変更が必要

## 3. Build / Verify Goal

最新のDesign Docに従って実装し、検証まで完了します。

この段階では、AIに既存パターンに沿った実装判断、必要なテスト追加、小さな型修正や呼び出し側調整を任せます。一方で、新規依存、DB変更、API仕様変更、破壊的git操作が必要になった場合はStop条件としてエスカレーションします。

主な成果物:

- 実装差分
- 追加・更新されたテスト
- 検証結果
- 残リスクや未確認事項

止まる条件:

- Design Docと違う実装が必要
- スコープ外の変更が必要
- 受け入れ条件に矛盾がある
- 新規依存、DB変更、API仕様変更、破壊的git操作が必要
- 検証失敗が今回の変更と無関係

## 4. Ship / Learn Goal

実装差分を出荷判断できる形に整え、次回以降のAI実行単位に渡すべき学習を抽出します。

この工程は、PR作成、監督に必要な証跡整理、残リスク整理、ナレッジ更新候補の抽出をまとめて扱います。恒久ナレッジ更新は毎回必須ではありません。

主な成果物:

- PR本文
- 変更内容の要約
- PRD / Design Doc / 実装差分 / 検証結果の接続
- 受け入れ条件との対応
- 未確認事項・残リスク
- 必要な場合だけ、恒久ナレッジ更新
- 次のGoal候補

止まる条件:

- 未解決の仕様判断が残っている
- 検証が未完了
- 差分にスコープ外変更が混じっている
- PR作成先、対象ブランチ、関連Issueが曖昧
- 恒久ナレッジにするか判断が必要

## 小さな変更では省略する

すべての変更を4工程に分ける必要はありません。

typo修正、軽微なログ追加、1文で差分を説明できる小さな変更は、PRDやDesign Docを独立Goalにしなくてよいです。

逆に、複数ファイルにまたがる変更、仕様判断を含む変更、初見の領域を触る変更、検証方法が重要な変更では、探索と計画を実装から分離します。

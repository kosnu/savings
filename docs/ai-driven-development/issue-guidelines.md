---
title: AI Driven Development Issue Guidelines
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - issue
  - requirements
  - codex-goal
when_to_read:
  - AI駆動開発の起点になるIssueを書くとき
  - Issue、Requirements / PRD、Design Docの役割分担を確認するとき
  - Issueに実装詳細を書きすぎるか迷うとき
---

# AI Driven Development Issue Guidelines

Issueは、Requirements / PRDの入力です。

Issueに書くべきものは、AIがRequirements / PRDを作れるだけの「意図と境界」です。Design Doc相当の実装方針や、具体的な作業手順まで書きすぎると、人間が作業分解し、AIが代行する形に戻りやすくなります。

## 役割分担

- Issue: なぜやるか、何が成功か、どこまで任せるか
- Requirements / PRD: AIがIssueと既存文脈から、要求と受け入れ条件に展開する
- Design Doc: AIがRequirements / PRDから、実装方針、影響範囲、検証方針に展開する
- Build / Verify: AIがDesign Docに沿って実装し、検証する
- Ship: AIがBuild / Verify済みの成果をPR、検証結果、残リスク、レビュー返信として提出できる形に整える
- Learn: AIがレビューコメント、検証結果、運用知見、ルール・ポリシー変更を次回Requirementsの入力へ整理する

## Issueに書くもの

Issueには、目的、制約、成功条件、AIの自律範囲、Stop条件を書きます。

- 背景
- 解決したい課題
- 期待する状態
- スコープ内 / 外
- 守るべき制約
- 成功条件
- AIに任せてよい範囲
- Stop条件

## Issueに書きすぎないもの

次の内容は、必要な制約でない限りIssueには書きすぎません。

- 具体的な関数名やファイル名の指定
- 詳細な実装手順
- テストコードの書き方
- 特定hookやcomponentの修正指示
- 人間が先回りして決めた責務分離や抽象化
- Design Docで比較すべき実装案の結論

既知の制約として必要な場合は、「実装指示」ではなく「守るべき境界」として書きます。

## Stop条件として書くもの

AIが自律的に進めてよい前提でも、次の条件では止まって監督者へエスカレーションします。

- 要件の意図が複数解釈できる
- 成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要
- 新規依存が必要
- DB / API / 認証 / 権限モデルの変更が必要
- 破壊的なgit操作が必要
- 検証失敗の原因が今回の変更と無関係

## Issueテンプレート

GitHubで使うIssueテンプレートは、[.github/ISSUE_TEMPLATE/ai_driven_development.md](../../.github/ISSUE_TEMPLATE/ai_driven_development.md) に置きます。

このドキュメントでは、テンプレートの意図と運用方針だけを説明します。

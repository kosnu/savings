---
name: small
description: 小規模タスク用ワークフロー（1-3ファイル）。バグ修正、設定変更など単純な変更に使用。サブエージェント不使用で直接作業する。Use when the user says "/small".
disable-model-invocation: true
argument-hint: "[issue-number or task description]"
---

# Small ワークフロー

1-3ファイル程度の小規模な変更を、サブエージェントを使わずに直接実行するワークフローです。

## 手順

### 1. タスク把握

- `$ARGUMENTS` がIssue番号の場合、`gh issue view $ARGUMENTS` で内容を取得する
- 変更対象のファイルと影響範囲を特定する

### 2. 調査

- 対象ファイルを読み、現状のコードを理解する
- 関連するテストファイルがあれば確認する

### 3. 実装

- 変更を実施する
- 変更は最小限に留め、タスクの目的に直接関係する修正のみ行う

### 4. 検証

- 変更が入ったワークスペースの検証を実行する:
  - `apps/web/`: `cd apps/web && task check && task test`
  - `apps/api/`: 該当function ディレクトリで `deno test --allow-read --allow-env`
- 検証が失敗した場合は修正する

### 5. コミット

- `/committing-changes` スキルの手順に従ってコミットする

## ルール

- サブエージェント（Taskツール）は使用しない
- 変更は3ファイル以内に収める。超える場合はユーザーに `/medium` への切り替えを提案する
- 作業と無関係なコードの改善は行わない

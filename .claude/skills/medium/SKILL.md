---
name: medium
description: 中規模タスク用ワークフロー（4-10ファイル）。新機能追加やリファクタリングなど単一アプリ内の変更に使用。サブエージェントを活用して効率的に作業する。Use when the user says "/medium".
disable-model-invocation: true
argument-hint: "[issue-number or task description]"
---

# Medium ワークフロー

4-10ファイル程度の中規模な変更を、サブエージェントを活用して効率的に実行するワークフローです。
メインエージェント（あなた）がリーダーとして全体を統括します。

## 手順

### 1. タスク把握

- `$ARGUMENTS` がIssue番号の場合、`gh issue view $ARGUMENTS` で内容を取得する
- 変更対象のアプリ（web / api）とスコープを特定する

### 2. 調査（Exploreサブエージェント）

- Taskツール（`subagent_type: Explore`）で関連コードの調査を委任する
- 調査観点: 対象コードの構造、既存パターン、影響範囲、関連テスト
- メインコンテキストを温存するため、広範な調査はサブエージェントに任せる

### 3. 計画策定

- 調査結果をもとに実装計画を策定する
- 変更ファイル一覧、実装順序、テスト方針を明確にする
- **計画をユーザーに提示し、承認を得てから実装に進む**

### 4. 実装（general-purposeサブエージェント）

- Taskツール（`subagent_type: general-purpose`）で実装を委任する
- サブエージェントへの指示に以下を含める:
  - 対象アプリに応じたエージェント原則（`.claude/agents/fe-engineer.agent.md` または `.claude/agents/be-engineer.agent.md` の内容）
  - 具体的な実装計画と変更すべきファイル一覧
  - コーディング規約とテスト要件
- 実装が大きい場合は複数のサブエージェントに分割して並行実行してもよい

### 5. レビュー（general-purposeサブエージェント）

- Taskツール（`subagent_type: general-purpose`）でレビューを委任する
- `.claude/agents/reviewer.agent.md` のレビュー観点と出力形式を指示に含める
- `git diff` の結果をレビュー対象として渡す
- Critical 指摘がある場合は修正してから次に進む

### 6. 検証

- 変更が入ったワークスペースの検証を実行する:
  - `apps/web/`: `cd apps/web && task check && task test`
  - `apps/api/`: 該当function ディレクトリで `deno test --allow-read --allow-env`
- 検証が失敗した場合は修正する

### 7. コミット

- `/committing-changes` スキルの手順に従ってコミットする

## ルール

- 計画のユーザー承認を省略しない
- サブエージェントへの指示は具体的に書く（「適切に実装して」のような曖昧な指示は避ける）
- 変更が10ファイルを超えそうな場合はユーザーに `/large` への切り替えを提案する
- 作業と無関係なコードの改善は行わない

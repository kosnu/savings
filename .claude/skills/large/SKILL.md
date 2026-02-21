---
name: large
description: 大規模タスク用ワークフロー（10+ファイル、FE+BE横断）。新規エンドポイント+UIなどの横断的な機能開発に使用。worktreeで並行実装する。Use when the user says "/large".
disable-model-invocation: true
argument-hint: "[issue-number or task description]"
---

# Large ワークフロー

10ファイル超のFE+BE横断の大規模な変更を、worktreeによる並行実装で効率的に実行するワークフローです。
メインエージェント（あなた）が指揮者として全体を統括し、実装詳細はサブエージェントに委任します。

## 手順

### 1. タスク把握

- `$ARGUMENTS` がIssue番号の場合、`gh issue view $ARGUMENTS` で内容を取得する
- FE/BEそれぞれの変更スコープを特定する

### 2. 調査・設計（Planサブエージェント）

- Taskツール（`subagent_type: Plan`）で全体設計を策定する
- 調査観点:
  - 既存のAPI設計とデータモデル
  - フロントエンドのルーティングとコンポーネント構成
  - 影響を受ける既存機能
- **設計をユーザーに提示し、承認を得る**

### 3. API契約合意

- FE/BE間のインターフェースを定義する:
  - エンドポイント（メソッド、パス、ステータスコード）
  - リクエスト/レスポンスの型定義
  - エラーレスポンスの形式
- **API契約をユーザーに提示し、承認を得てから並行実装に進む**

### 4. FE/BE並行実装（worktreeサブエージェント）

- Taskツール（`isolation: "worktree"`）でFEとBEの実装を**並行で**起動する:

  **BEサブエージェント:**
  - `subagent_type: general-purpose`, `isolation: "worktree"`
  - `.claude/agents/be-engineer.agent.md` の原則を指示に含める
  - API契約に基づくエンドポイント実装、テスト作成

  **FEサブエージェント:**
  - `subagent_type: general-purpose`, `isolation: "worktree"`
  - `.claude/agents/fe-engineer.agent.md` の原則を指示に含める
  - API契約に基づくUI実装、テスト作成

- 両方のサブエージェントの完了を待つ

### 5. 統合

- 各worktreeの変更をメインブランチに統合する
- コンフリクトがあれば解消する
- FE/BEの接続点（API呼び出し、型定義）が一致していることを確認する

### 6. レビュー（general-purposeサブエージェント）

- Taskツール（`subagent_type: general-purpose`）でレビューを委任する
- `.claude/agents/reviewer.agent.md` のレビュー観点を指示に含める
- FE/BE両方の変更差分をレビュー対象として渡す
- Critical 指摘がある場合は修正する

### 7. 検証

- 両ワークスペースの検証を実行する:
  - `apps/web/`: `cd apps/web && task check && task test`
  - `apps/api/`: 該当function ディレクトリで `deno test --allow-read --allow-env`
- 検証が失敗した場合は修正する

### 8. コミット・PR

- `/committing-changes` スキルの手順に従ってコミットする
- 必要に応じて `/creating-draft-pr` スキルでDraft PRを作成する

## ルール

- 設計とAPI契約のユーザー承認を省略しない
- メインエージェントは指揮に徹し、実装コードを直接書かない
- FE/BEサブエージェントは必ず `isolation: "worktree"` で起動する
- API契約を事前に合意してから並行実装を開始する
- 作業と無関係なコードの改善は行わない

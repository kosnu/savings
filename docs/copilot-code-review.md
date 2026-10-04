---
title: Copilotコードレビューの消費削減策
doc_type: overview
status: accepted
area: repository
applies_to:
  - .github/instructions
  - .github/skills/code-review
  - docs/harness/policies/code-review.md
topics:
  - copilot
  - code-review
  - consumption
when_to_read:
  - Copilotコードレビューの消費削減策と採用理由を確認するとき
  - Copilotレビュー指示や起動条件の変更・復旧を判断するとき
---

# Copilotコードレビューの消費削減策

[Issue #1872](https://github.com/kosnu/savings/issues/1872) の対策として、レビュー入口の重複を減らし、差分から必要な文脈へ直接辿る指示を導入する。判断の正本は [Code Review Policy](harness/policies/code-review.md)。この文書は仕様確認・採否・復旧の説明であり、毎回のレビューで追加取得する必須文書ではない。

## 仕様と現状の確認（2026-10-04）

GitHubの[公式仕様](https://docs.github.com/en/copilot/concepts/agents/code-review)では、コードレビューはAI creditsとagentic機能のGitHub Actions時間を消費する。AI creditsはモデルと処理トークン数に依存し、消費は一般にPR規模とrepository custom instructionsに応じて増える。モデル切替は非対応。これを対象アカウントの契約・請求実績を確認した証拠とは扱わない。

[専用指示の仕様](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)では、`.github/instructions/*.instructions.md` の `applyTo` と `excludeAgent` を利用できる。`excludeAgent: "cloud-agent"` はCopilot cloud agentから除外する指定であり、レビュー対象ファイルや内部探索を除外する指定ではない。[IDEの公式仕様](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide)では、pathに一致する指示はCopilot Chatでも利用される。Chatへの適用は許容し、本文でレビュー契約を適用する依頼条件を明示する。Chatへの適用を止めることを、PRレビュー1回あたりの消費削減策とは扱わない。custom instructionsは既定で有効だが、このrepositoryのトグル状態は未確認。

公式仕様ではrootの `AGENTS.md` は自動参照され、関連するreview skillも利用され得る。専用指示の追加で `AGENTS.md` の読み込みを無効化できるとは扱わない。[公式の指示作成ガイド](https://docs.github.com/en/copilot/tutorials/customize-code-review)も簡潔で具体的な指示を推奨するが、指示の遵守は非決定的である。

GitHub REST APIの `repos/kosnu/savings/rulesets/{id}` を読み取り、次を確認した。

- `Copilot review for default branch`（ID: 13365699、active）：default branch向けで `review_draft_pull_requests: true`、`review_on_push: false`。Draftも自動レビュー対象で、追加push時の自動再レビューは無効。
- `main`（ID: 1946213、active）：Approve 1件、CODEOWNER review、会話解決が必須で、push後の古いApproveを破棄する。

個人設定とreview effortの実値は未確認。起動タイミング・review effort・Ruleset・MCP設定は変更しない。[Issue #1700](https://github.com/kosnu/savings/issues/1700) の最新HEADへのレビュー確認と保護条件を維持する。

## 採用した対策

- 全pathに適用する短いレビュー用instructionsから正本へ直接案内する。関連skillが選ばれなくても入口を提供し、Copilot cloud agentには適用しない。Chatで利用されても、レビュー契約は差分レビュー時だけ適用し、通常の実装・修正・質問の権限は依頼と既存の実行権限に従う。
- review skillに重複していた手順・観点・レポート契約を正本へ集約する。skillは用途と参照先を示す短いadapterにする。
- 正本で差分起点の文脈取得と同一実行内の既読再利用を定める。全変更面の必須ruleと依存を集め、必要な関連コードを読み、不足があるときだけ追加探索する。

指示量と重複取得を減らすことで1回のレビューの負荷を抑えられると見込む。ただし、自然言語の指示は内部のfull project context gatheringを強制制限する設定ではなく、削減量や課金額の低下を保証しない。内部トークン数の測定、改善前後の比較、複数PRの継続観測は行わない。

品質面では、path/surface一致、`depends_on`、policyが指定する必須参照、複数変更面の和集合、必要な呼び出し元・先の確認、ADR履歴検査、Coverageと検証不足の報告を維持する。固定の探索上限や関連コードの一律除外は設けない。

## 採用しなかった対策

- **レビュー深度の一律低下**：公式にはLite/Balancedがあるが、品質への影響を伴う。今回は既存の深度を維持する。
- **起動回数だけの削減**：1回あたりの消費を主対象とし、最新HEADへの必要なレビューを省略しない。
- **ファイル除外やMCP無効化**：[標準除外の公式一覧](https://docs.github.com/en/copilot/reference/review-excluded-files)を任意の対象除外・読み込み禁止の契約とは扱わない。必要な関連コードや外部情報を一律で遮断しない。
- **消費上限・特定モデル・トークン数の指定**：自然言語で課金や内部探索を確実に制御できるという根拠はない。

## 運用と戻し方

従来の自動レビューと手動再レビューを継続する。新しい計測、レビュー前の成果物、追加のCopilotレビューを必須化しない。指示はhead branchから使われるため、導入PRで選択される場合があるが、検証目的の再レビューは要求しない。

復旧はこの対策のcommitをrevertするか、レビュー専用instructionsを削除し、skill・正本・索引を変更前の状態へまとめて戻す。GitHubの起動・保護・請求設定は変更していないため設定復旧は不要。通常の検証・レビューを行って復旧PRを配信する。

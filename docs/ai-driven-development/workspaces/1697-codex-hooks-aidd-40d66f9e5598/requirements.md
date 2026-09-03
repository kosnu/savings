---
title: "Requirements: Codex HooksでAIDDの検証漏れとコンパクション後の工程逸脱を防ぐ"
doc_type: requirements
status: proposed
area: repository
applies_to:
  - .codex
  - .agents
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - codex-hooks
  - validation
  - requirements
when_to_read:
  - Issue #1697の設計、実装、検証を行うとき
  - AIDD制御面のStop hookとcompact SessionStart hookの要求境界を確認するとき
---

# Requirements: Codex HooksでAIDDの検証漏れとコンパクション後の工程逸脱を防ぐ

- Issue: `kosnu/savings#1697`
- Issue URL: `https://github.com/kosnu/savings/issues/1697`
- Issue updatedAt: `2026-09-03T17:14:37Z`
- Issue本文SHA-256: `03dc041a63302f4f034fe34b1db5bb0b667e8e395a389553104e57e52cf51404`
- Workspace: `1697-codex-hooks-aidd-40d66f9e5598`

## Cycle Identity

- Cycle-start Issue title: Codex HooksでAIDDの検証漏れとコンパクション後の工程逸脱を防ぐ

## Requirements Input Gate

```json
{"depends_on":[{"id":"ai-driven.workflow","via":"ai-driven.checker"},{"id":"adr.harness-engineering","via":"ai-driven.checker"},{"id":"documentation.policy","via":"ai-driven.checker"},{"id":"ai-driven.overview","via":"ai-driven.workflow"}],"direct_rules":[{"id":"ai-driven.checker","issue_evidence":"`validation`","match":{"field":"topics","value":"validation"},"reason":"AIDD制御面の検証安全網とCodex Hooksを変更するため"}],"task_context":{"body_sha256":"03dc041a63302f4f034fe34b1db5bb0b667e8e395a389553104e57e52cf51404","issue":"kosnu/savings#1697","source":"issue_body","updated_at":"2026-09-03T17:14:37Z","url":"https://github.com/kosnu/savings/issues/1697"}}
```

## Requirements Completeness Gate

```json
{"baseline":{"body_sha256":"dd9c058045687f42d2bb330de22951388d563938ebb3babff74df9e74f99f62f","source":"git_head"},"issue_body_sha256":"03dc041a63302f4f034fe34b1db5bb0b667e8e395a389553104e57e52cf51404","requirements":[{"id":"FR-1","issue_evidence":null,"status":"unchanged"},{"id":"FR-2","issue_evidence":null,"status":"unchanged"},{"id":"FR-3","issue_evidence":null,"status":"unchanged"},{"id":"FR-4","issue_evidence":"また、rule-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる。","status":"new"},{"id":"NFR-1","issue_evidence":null,"status":"unchanged"},{"id":"NFR-2","issue_evidence":null,"status":"unchanged"},{"id":"NFR-3","issue_evidence":null,"status":"unchanged"},{"id":"NFR-4","issue_evidence":null,"status":"unchanged"},{"id":"NFR-5","issue_evidence":null,"status":"unchanged"},{"id":"AC-1","issue_evidence":null,"status":"unchanged"},{"id":"AC-2","issue_evidence":null,"status":"unchanged"},{"id":"AC-3","issue_evidence":null,"status":"unchanged"},{"id":"AC-4","issue_evidence":null,"status":"unchanged"},{"id":"AC-5","issue_evidence":null,"status":"unchanged"}],"retired":[],"sections":[{"id":"background","issue_evidence":null,"status":"unchanged"},{"id":"users","issue_evidence":null,"status":"unchanged"},{"id":"stories","issue_evidence":null,"status":"unchanged"},{"id":"scope","issue_evidence":null,"status":"unchanged"},{"id":"functional","issue_evidence":"また、rule-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる。","status":"changed"},{"id":"non-functional","issue_evidence":null,"status":"unchanged"},{"id":"acceptance","issue_evidence":"- [ ] rule-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる","status":"changed"},{"id":"qa","issue_evidence":null,"status":"unchanged"},{"id":"technical","issue_evidence":null,"status":"unchanged"}],"workspace":"1697-codex-hooks-aidd-40d66f9e5598"}
```

## 背景

AIDDの工程契約はworkflow、skill、aidd-checkerで明示されている一方、制御面変更後の検証漏れやコンパクション後の工程逸脱を自動的に検知する安全網はない。

## 対象ユーザーと利用シーン

現在のAIDD作業を実行するagentと、その工程境界および検証完了を確認する開発者を対象とする。

## ユーザーストーリー

AIDD実行者として、必要な整合性検証を行わずにターンを終了できる状態を防ぎ、コンパクション後も同じ工程契約に従いたい。

## スコープ

対象はリポジトリで信頼されたCodex Hooks設定、Stop時の検証安全網、compact直後の工程不変条件再注入、関連するworkflow・skill・設定・テストの同期。対象外はPreToolUseによるphase別強制、Hook専用状態、aidd-checker置換、Learn自動実行、アプリケーション機能変更。

## 機能要件

AIDD制御面に関連する差分がある場合だけStop時の検証を判断し、compact直後だけ工程不変条件を再注入する。また、rule-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる。

- FR-1: AIDD制御面に関連する差分がある場合だけ、\`Stop\`時に必要な整合性検証が評価される安全網を提供する。
- FR-2: \`stop\_hook\_active\`を考慮し、修正不能時に無限継続しない再入制御を行う。
- FR-3: コンパクション直後に、現在Goal、親agentのGoal所有、上流成果物のread\-only、Build \/ VerifyからShipへの遷移、Learn非自動実行が再注入される。
- FR-4: また、rule\-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる。

## 非機能要件

既存workflowとaidd-checkerを正本に保ち、第二の状態管理を作らない。検証成功cacheは、Codex session、canonical worktree、Git `HEAD`、Go toolchain、Gitで無視されないworktree変更状態が同一の場合だけ再利用し、必要なidentityを取得できない場合は再利用しない。Hooksの利用不能時にも既存経路を維持する。

- NFR-1: Hookは既存gateを補助する安全網とし、第二の状態管理を作らない。
- NFR-2: SessionStartの追加コンテキストは工程不変条件だけに限定し、Issue本文や成果物全文を注入しない。
- NFR-3: Hooksが無効または利用不能な環境でも、既存AIDD workflowを実行できる。
- NFR-4: 新規外部依存を追加しない。
- NFR-5: 検証成功cacheは、Codex session、canonical worktree、Git \`HEAD\`、Go toolchain、Gitで無視されないworktree変更状態が同一の場合だけ再利用し、必要なidentityを取得できない場合は再利用しない。

## 受け入れ条件

対象差分の選別、検証成功・失敗、再入防止、compact時のコンテキスト内容を回帰テストする。同じAIDD制御面差分でも、session、worktree、`HEAD`、Go toolchain、またはGitで無視されないworktree変更状態が変われば再検証され、同一状態だけ成功cacheを再利用する。

- [ ] rule-mapへ追加されたAIDD制御面のpathが、Hook側の個別同期なしで検証対象になる

- AC-1: 検証失敗時は理由を示して作業継続を要求し、成功済みの同一差分では不要な再実行をしない。
- AC-2: Hookが既存workflowまたは\`aidd\-checker\`の判定を上書きしない。
- AC-3: Hooks無効時の既存AIDD workflowが維持される。
- AC-4: 発火対象・対象外、成功・失敗、再入防止、コンテキスト内容の回帰テストが成功する。
- AC-5: 同じAIDD制御面差分でも、session、worktree、\`HEAD\`、Go toolchain、またはGitで無視されないworktree変更状態が変われば再検証され、同一状態だけ成功cacheを再利用する。

## Q\&A

- Q: Hook入力だけで安全な判定ができない場合はどうするか。
  - A: Hookから信頼できる入力だけでは対象差分または再入状態を判定できない場合は停止し、新たな状態正本を推測で追加しない。

## 技術的考慮事項

transcriptの解析による現在phaseの推測は行わず、既存AIDD制御面に従うGo実装と宣言設定の境界を維持する。

## Rule Selection

- Direct: `ai-driven.checker`。AIDD制御面の検証安全網とCodex Hooksを変更するため。
- Depends-on: `ai-driven.workflow`（via `ai-driven.checker`）。
- Depends-on: `adr.harness-engineering`（via `ai-driven.checker`）。
- Depends-on: `documentation.policy`（via `ai-driven.checker`）。
- Depends-on: `ai-driven.overview`（via `ai-driven.workflow`）。
- Conflict: none。

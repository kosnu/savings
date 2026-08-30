---
title: "Requirements: 言語設定をアカウントに保存して端末間で同期する"
doc_type: requirements
status: proposed
area: repository
applies_to:
  - apps/web
  - apps/api
  - docs/harness/contracts/user-account-attributes.json
topics:
  - account-preference
  - language
  - synchronization
  - requirements
when_to_read:
  - Issue #1563の設計、実装、検証を行うとき
  - 認証済みユーザーの言語設定と端末値の優先順位を確認するとき
---

# Requirements: 言語設定をアカウントに保存して端末間で同期する

- Issue: `kosnu/savings#1563`
- Issue URL: `https://github.com/kosnu/savings/issues/1563`
- Issue updatedAt: `2026-08-21T18:21:05Z`
- Issue本文SHA-256: `720c639fc3de0a40f81fab11be57db3cf20a6420b2896dc99edf7f582787513b`
- Workspace: `1563-issue-345418f11192`

## Cycle Identity

- Cycle-start Issue title: 言語設定をアカウントに保存して端末間で同期する

## Requirements Input Gate

```json
{"depends_on":[],"direct_rules":[{"id":"domain.user","issue_evidence":"`public.users.language` を言語設定の永続的な保存先として追加する","match":{"field":"domains","value":"user"},"reason":"認証ユーザー属性の保存先と更新境界を変更するため"}],"task_context":{"body_sha256":"720c639fc3de0a40f81fab11be57db3cf20a6420b2896dc99edf7f582787513b","issue":"kosnu/savings#1563","source":"issue_body","updated_at":"2026-08-21T18:21:05Z","url":"https://github.com/kosnu/savings/issues/1563"}}
```

## Requirements Completeness Gate

```json
{"baseline":{"body_sha256":null,"source":"none"},"issue_body_sha256":"720c639fc3de0a40f81fab11be57db3cf20a6420b2896dc99edf7f582787513b","requirements":[{"id":"FR-1","issue_evidence":"`public.users.language` を言語設定の永続的な保存先として追加する","status":"new"},{"id":"FR-2","issue_evidence":"ログイン時の言語設定取得","status":"new"},{"id":"FR-3","issue_evidence":"言語変更時の保存","status":"new"},{"id":"FR-4","issue_evidence":"既存localStorage値との優先順位","status":"new"},{"id":"FR-5","issue_evidence":"未設定・取得失敗・保存失敗時の挙動","status":"new"},{"id":"NFR-1","issue_evidence":"対応言語は既存の日本語と英語を維持する","status":"new"},{"id":"NFR-2","issue_evidence":"既存の `name` のみというルールは `language` の追加範囲で変更し、他のプロフィール列は更新可能にしない","status":"new"},{"id":"AC-1","issue_evidence":"アカウント値と端末値が異なる場合も、初回のユーザー向け表示がアカウント言語で行われる","status":"new"},{"id":"AC-2","issue_evidence":"既存の日本語・英語表示が壊れていない","status":"new"}],"retired":[],"sections":[{"id":"background","issue_evidence":"現在の言語設定はブラウザの `localStorage` にだけ保存される","status":"new"},{"id":"users","issue_evidence":"同じユーザーが別端末や別ブラウザでログインしても","status":"new"},{"id":"stories","issue_evidence":"認証済みユーザーの言語設定がアカウントに保存され","status":"new"},{"id":"scope","issue_evidence":"未認証ユーザーのアカウント設定","status":"new"},{"id":"functional","issue_evidence":"言語変更時の保存","status":"new"},{"id":"non-functional","issue_evidence":"言語取得に失敗してもアプリを利用不能にしない","status":"new"},{"id":"acceptance","issue_evidence":"別端末で同じ言語設定が反映される","status":"new"},{"id":"qa","issue_evidence":"アカウント設定と端末設定のどちらを優先するか","status":"new"},{"id":"technical","issue_evidence":"必要なDB migration、型・API境界、RLS・更新条件、回帰テストを同期して変更する","status":"new"}],"workspace":"1563-issue-345418f11192"}
```

## 背景

現在の言語設定はブラウザの `localStorage` にだけ保存されるため、アカウント単位の端末間同期ができていない。

## 対象ユーザーと利用シーン

同じユーザーが別端末や別ブラウザでログインしても、選択済み言語を引き継ぎたい認証済み利用者を対象とする。

## ユーザーストーリー

認証済みユーザーの言語設定がアカウントに保存され、どの端末でも初回から保存済み言語で利用できる。

## スコープ

対象は保存先、ログイン時取得、変更時保存、端末値との優先順位、失敗時挙動。対象外は対応言語追加、テーマ同期、未認証ユーザーのアカウント設定、その他プロフィール項目。

## 機能要件

取得、優先順位、言語変更時の保存、fallbackを一貫したアカウント設定フローとして扱う。

- FR-1: \`public\.users\.language\` を言語設定の永続的な保存先として追加する。認証済みアカウントの値を端末側の値より優先する。
- FR-2: ログイン時の言語設定取得を行い、取得成功またはfallback決定まで認証済みユーザー向け画面の言語を確定表示しない。
- FR-3: 言語変更時の保存をアカウントへ行い、保存結果を判定できるようにする。
- FR-4: 既存localStorage値との優先順位を定義し、アカウント値が未設定または取得失敗の場合だけ端末値または既定言語をfallbackに使い、推測値を自動保存しない。
- FR-5: 未設定・取得失敗・保存失敗時の挙動を定義し、取得失敗時はfallback決定後に利用を継続し、保存失敗を成功として扱わない。

## 非機能要件

言語取得に失敗してもアプリを利用不能にしない。既存言語と属性更新の最小権限を維持する。

- NFR-1: 対応言語は既存の日本語と英語を維持する。対応言語追加や翻訳方針変更を行わない。
- NFR-2: 既存の \`name\` のみというルールは \`language\` の追加範囲で変更し、他のプロフィール列は更新可能にしない。本人行の列単位権限、RLS、型、API境界を同期する。

## 受け入れ条件

別端末で同じ言語設定が反映されることを、初回表示と各失敗経路を含めて確認する。

- AC-1: 別端末で保存済み言語が反映され、アカウント値と端末値が異なる場合も、初回のユーザー向け表示がアカウント言語で行われる。
- AC-2: 未設定・取得失敗・保存失敗の回帰検証があり、既存の日本語・英語表示が壊れていない。

## Q\&A

- Q: アカウント設定と端末設定のどちらを優先するか。
  - A: 取得できたアカウント値を優先し、未設定または取得失敗時だけ端末値、次に既定値へfallbackする。

## 技術的考慮事項

必要なDB migration、型・API境界、RLS・更新条件、回帰テストを同期して変更する。属性contractを実装時の機械正本とする。

## Rule Selection

- Direct: `domain.user`。認証ユーザー属性の保存先と更新境界を変更するため。
- Conflict: none。

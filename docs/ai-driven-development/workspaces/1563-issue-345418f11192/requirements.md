---
title: "Requirements: 言語設定をアカウントに保存して端末間で同期する"
doc_type: requirements
status: proposed
area: web
applies_to:
  - apps/web
  - apps/api
topics:
  - user
  - auth
  - language
  - synchronization
when_to_read:
  - Issue #1563の言語設定同期を設計、実装、検証するとき
---

## Cycle Identity

- Cycle-start Issue title: 言語設定をアカウントに保存して端末間で同期する

## Requirements Input Gate

```json
{"task_context":{"source":"issue_body","issue":"kosnu/savings#1563","url":"https://github.com/kosnu/savings/issues/1563","updated_at":"2026-08-21T18:21:05Z","body_sha256":"720c639fc3de0a40f81fab11be57db3cf20a6420b2896dc99edf7f582787513b"},"direct_rules":[{"id":"domain.user","issue_evidence":"public.users.language","match":{"field":"domains","value":"user"},"reason":"アカウントの言語列をユーザードメインの責務として定義する。"}],"depends_on":[]}
```

## Requirements Completeness Gate

```json
{"issue_body_sha256":"720c639fc3de0a40f81fab11be57db3cf20a6420b2896dc99edf7f582787513b","workspace":"1563-issue-345418f11192","baseline":{"source":"git_head","body_sha256":"2e53628ec90e7e98b9f34f9ec8f74067bcae4a54a41aad164bd55da1ae3c0891"},"requirements":[{"id":"FR-1","status":"unchanged","issue_evidence":null},{"id":"FR-2","status":"unchanged","issue_evidence":null},{"id":"FR-3","status":"unchanged","issue_evidence":null},{"id":"FR-4","status":"unchanged","issue_evidence":null},{"id":"FR-5","status":"unchanged","issue_evidence":null},{"id":"NFR-1","status":"unchanged","issue_evidence":null},{"id":"NFR-2","status":"unchanged","issue_evidence":null},{"id":"NFR-3","status":"unchanged","issue_evidence":null},{"id":"AC-1","status":"unchanged","issue_evidence":null},{"id":"AC-2","status":"unchanged","issue_evidence":null},{"id":"AC-3","status":"unchanged","issue_evidence":null},{"id":"AC-4","status":"unchanged","issue_evidence":null},{"id":"AC-5","status":"unchanged","issue_evidence":null},{"id":"AC-6","status":"unchanged","issue_evidence":null},{"id":"AC-7","status":"unchanged","issue_evidence":null},{"id":"AC-8","status":"unchanged","issue_evidence":null},{"id":"AC-9","status":"unchanged","issue_evidence":null}],"sections":[{"id":"background","status":"unchanged","issue_evidence":null},{"id":"users","status":"unchanged","issue_evidence":null},{"id":"stories","status":"unchanged","issue_evidence":null},{"id":"scope","status":"unchanged","issue_evidence":null},{"id":"functional","status":"unchanged","issue_evidence":null},{"id":"non-functional","status":"unchanged","issue_evidence":null},{"id":"acceptance","status":"unchanged","issue_evidence":null},{"id":"qa","status":"unchanged","issue_evidence":null},{"id":"technical","status":"unchanged","issue_evidence":null}],"retired":[]}
```

## 背景

現在の言語設定はブラウザの `localStorage` にだけ保存される。同じアカウントの設定がブラウザ外へ共有されず、端末ごとに異なる言語状態になる課題を解消する。

## 対象ユーザーと利用シーン

同じユーザーが別端末や別ブラウザでログインしても、アカウントを起点に同じ言語を利用できるユーザーシナリオを対象とする。未認証ユーザーのアカウント設定は対象外とする。

## ユーザーストーリー

プロフィール設定として選択した言語がアカウントに保存され、次のログイン時に端末へ反映されてほしい。利用者は設定の取得・保存結果を判断でき、失敗時もアプリを継続利用したい。

## スコープ

### 対象

- 保存先とログイン時取得の責務
- 言語変更時の保存と既存localStorage値との優先順位
- 未設定・取得失敗・保存失敗時の挙動

### 対象外

- 対応言語の追加
- テーマ設定の同期
- 未認証ユーザーのアカウント設定
- その他のプロフィール項目

## 機能要件

機能として次を定義する。

- 言語設定の保存先
- ログイン時の保存値取得
- 言語変更時の保存
- アカウント設定と端末設定の優先順位
- 未設定・取得失敗・保存失敗時の安全な継続

- FR-1: 言語設定はpublic\.users\.languageを永続的な保存先として追加する。ブラウザだけに分散させずアカウントが所有する。
- FR-2: 認証済みユーザーのログイン時はアカウント言語を取得し、アカウント言語の取得成功またはfallback決定前にユーザー向け画面を確定表示しない。保存済み言語がある場合は現在の端末へ反映する。
- FR-3: 言語変更時の保存を実行し、選択した日本語または英語をアカウントへ記録する。
- FR-4: 既存localStorage値との優先順位を明示し、アカウント設定と端末設定の競合時に決定的な値を採用する。
- FR-5: 言語設定を取得・保存できたかを判断できるよう、各種未設定や取得・保存の失敗時の挙動を定義し、失敗してもアプリを利用不能にせず安全な既定値へ戻す。

## 非機能要件

- 対応言語は既存の日本語と英語を維持する
- 認証済みユーザー自身のlanguageだけを更新対象にする
- DB migration、型・API境界、RLS・更新条件、回帰テストを同期する

- NFR-1: 対応言語は既存の日本語と英語を維持する。
- NFR-2: クライアントが自身の \`language\` を更新できるようにし、認証・RLS・API境界で他ユーザーのデータ更新を許可しない。
- NFR-3: 既存の \`name\` のみというルールは \`language\` の追加範囲で変更し、他のプロフィール列は更新可能にしない。

## 受け入れ条件

## 成功条件

保存先、ログイン時反映、変更保存、端末間同期、異常系、既存表示、検証可能性を確認できること。

- AC-1: 言語設定の保存先と所有責務が定義されていることを確認できる。
- AC-2: ログイン時に保存済み言語が反映されることを確認できる。
- AC-3: 言語変更がアカウントへ保存されることを確認できる。
- AC-4: 別端末で同じ言語設定が反映されることを確認できる。
- AC-5: 未設定・取得失敗・保存失敗時の挙動が定義されていることを確認できる。
- AC-6: 既存の日本語・英語表示が壊れていないことを回帰検証する。
- AC-7: 必要な検証ができるよう、migration・型・API境界・RLS・更新条件・回帰テストを同期する。
- AC-8: アカウント値と端末値が異なる場合も、初回のユーザー向け表示がアカウント言語で行われることを確認できる。
- AC-9: 取得失敗時はfallback決定後にアプリを継続利用できることを確認できる。

## Q\&A

## 判断したいこと

- アカウント設定と端末設定のどちらを優先するか
- 言語設定を取得・保存できたか
- 未設定や失敗時にどの既定値で継続するか

## 技術的考慮事項

必要なDB migration、型・API境界、RLS・更新条件、回帰テストを同期して変更する。既存のプロフィール更新境界をlanguageの追加範囲に限って拡張し、他のプロフィール列へ波及させない。

## Rule Selection

- Direct: `domain.user`。アカウントの言語列をユーザードメインの責務として定義する。
- Conflict: none。

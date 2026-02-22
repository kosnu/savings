---
name: committing-changes
description: Stages and commits changes with workspace-specific verification and Japanese commit messages. Use when the user asks to commit, stage changes, or says "コミットして".
disable-model-invocation: true
model: claude-sonnet-4-5
---

# コミット

## 手順

1. `git status` と `git diff --stat` で変更状況を把握する（`git diff` でフル差分を出さない。変更内容は自分が把握済み）
2. 変更が入ったワークスペースの検証を実行する:
   - `apps/web/`: `task check` → `task test`
   - `apps/api/`: 該当function ディレクトリで `deno test --allow-read --allow-env`
   - 検証失敗時はコミットしない
   - 直前にテスト・lint実行済みの場合はスキップしてよい
3. ファイル単位でステージングする（`git add -A` は意図した差分のみと確認できた場合に限る）
4. 観点ごと（機能追加、バグ修正、リファクタリング等）にコミットを分割する
5. `git diff --staged --stat` でタスク目的との一致を確認する
6. コミットメッセージ案をユーザーに提示し、承認を得てからコミットする
7. コミット後、`git log --oneline -1` と `git show --stat HEAD` で結果を確認する

## コミットメッセージ形式

```
{type}: {メッセージ}

{やったことや理由}

Co-Authored-By: Claude <noreply@anthropic.com>
```

- typeの例: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`
- タイトル・本文は日本語で記述する

## ルール

- 作業と無関係な差分はコミットに含めない
- コミットメッセージ案の事前確認を省略しない

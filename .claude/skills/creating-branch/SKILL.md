---
name: creating-branch
description: Creates a feature branch from a GitHub issue number. Use when the user asks to create a branch, start working on an issue, or says "ブランチを切って".
disable-model-invocation: true
model: claude-sonnet-4-5
argument-hint: "[issue-number]"
---

# ブランチ作成

## 手順

1. `gh issue view $ARGUMENTS` でIssueのタイトルと内容を取得する
2. Issueタイトルから英語の短いslugを生成する（小文字、ハイフン区切り）
3. ブランチ名 `issue-{番号}/{slug}` をユーザーに提示し、確認を得る
4. mainブランチを最新にし、そこからブランチを作成する:
   ```bash
   git fetch origin main
   git switch -c issue-{番号}/{slug} origin/main
   ```

## ルール

- slugは簡潔に（2〜4語程度）
- ブランチ名の確認なしで作成しない

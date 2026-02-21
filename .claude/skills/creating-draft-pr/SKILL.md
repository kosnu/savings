---
name: creating-draft-pr
description: Creates a Draft Pull Request using the repository's PR template. Use when the user asks to create a PR, draft PR, or says "PRを作って".
disable-model-invocation: true
model: claude-sonnet-4-5
---

# Draft PR作成

## 手順

1. ベースブランチ、ヘッドブランチ、関連Issue、変更スコープを確認する
2. `git status` でコミット漏れやPR対象外の差分がないことを確認する
3. `.github/PULL_REQUEST_TEMPLATE.md` を読み、テンプレート構造に沿ってPR本文を作成する:
   - 関連Issue番号をリンク
   - 変更内容を実際の差分に基づき記載
   - 動作確認は実施済みの検証のみチェック（未実施をチェック済みにしない）
   - 補足にレビューポイントを記載
4. PR本文をユーザーに提示し、承認を得てから作成する
5. `gh pr create --draft` でDraft PRを作成する
6. 作成後、タイトル・本文・ブランチ・Issueリンクが想定どおりか確認する

## ルール

- デフォルトはDraft（Ready for reviewは明示指示時のみ）
- テンプレートの見出しを削らない
- 空欄やダミー文言を残さない
- PR本文の確認なしでPRを作成しない

---
title: GitHub Issue Template Selection Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - .github/ISSUE_TEMPLATE
  - .agents/skills
  - docs/ai-driven-development
topics:
  - github
  - issue
  - issue-template
  - ai-driven-development
  - requirements
when_to_read:
  - GitHub Issueを作成するとき
  - Issueテンプレートを追加または変更するとき
  - Feature Request、AI Driven Development、Task、Bug Reportの選択に迷うとき
---

# GitHub Issue Template Selection Policy

GitHub Issueのテンプレートは、依頼の詳しさではなく、Issueがリポジトリの開発ライフサイクルで担う役割によって選ぶ。

## 基本原則

- ユーザーがテンプレートを明示した場合は、その指定を優先する。依頼内容とテンプレートの責務が矛盾する場合は、Issueを作成する前に確認する。
- 明示がない場合は、以下の選択順序に従う。
- 具体的なUI、挙動、制約、完了条件が書かれていることだけを理由に `Task` を選ばない。
- 新しいユーザー価値であることだけを理由に `Feature Request` を選ばない。
- CodexがIssueを作成することや、将来AIで実装できることだけを理由に `AI Driven Development` を選ばない。
- 過去のIssue、会話ログ、agentのメモは参考情報に限る。現在の依頼、関連Issue、リポジトリ内の正本文書とテンプレート定義を優先する。

## 選択順序

### 1. Bug Report

既存の期待動作が壊れている、または以前は動いていた挙動が退行している場合に選ぶ。

新しい期待動作を追加する依頼は、既存機能に関係していてもBug Reportとして扱わない。

### 2. Task

次のいずれかに該当する場合に選ぶ。

- 既存Issue、Requirements / PRD、Design Docなどで確定した成果を実行する下位作業
- 新しいプロダクト価値の判断を必要としない、保守、運用、依存更新、文書修正などの独立作業

依頼が具体的であることはTaskの選択条件ではない。

### 3. AI Driven Development

新しい価値または既存価値の変更について、IssueをRequirements / PRDの入力とし、Design、Build / Verify、Shipへ進める開発の起点にする場合に選ぶ。

ユーザーが機能の作成や変更を求め、提案の記録ではなく開発開始を意図している場合は、AI Driven Developmentを選ぶ。関連するFeature Requestが存在する場合は関連Issueとして扱い、それだけを理由にTaskへ切り替えない。

AI Driven Development Issueの内容と後続成果物の責務は、[AI Driven Development Issue Guidelines](../../ai-driven-development/issue-guidelines.md)に従う。

### 4. Feature Request

新しい価値を要望、提案、比較、検討の対象として記録し、まだRequirements / PRD以降の開発開始を意図していない場合に選ぶ。

実装まで進める意図が明確な依頼を、単に新機能であるという理由でFeature Requestにしない。

## 曖昧な場合

リポジトリ内の関連Issueと正本文書を確認してもFeature RequestとAI Driven Developmentのどちらか決められない場合は、次の一点だけを確認する。

> このIssueは新機能の提案として残しますか、それともAI Driven Developmentで開発を開始する起点にしますか？

回答を得るまで複数テンプレートの本文を作らず、Issueも作成しない。

## 判定例

| 依頼 | 選択 | 理由 |
| --- | --- | --- |
| 既存の支払い登録が保存できなくなった | Bug Report | 既存の期待動作が壊れている |
| Issueで確定した支払い候補取得処理を実装する | Task | 確定済み成果の下位作業 |
| よくある支払いを表示し、選択内容をフォームへ入力できる機能を作成する | AI Driven Development | 新しい価値を開発へ進める起点 |
| よくある支払いを表示する案を要望として残す | Feature Request | 開発開始前の提案記録 |

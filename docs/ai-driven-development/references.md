---
title: AI Driven Development References
doc_type: reference
status: accepted
area: repository
applies_to:
  - docs
topics:
  - ai-driven-development
  - agentic-coding
  - openai
  - claude-code
  - codex
when_to_read:
  - AI駆動開発フローの根拠を確認するとき
  - OpenAIやClaude Codeの一次情報と対応づけるとき
---

# AI Driven Development References

AI駆動開発フローを整理するために確認した一次情報と、このリポジトリでの解釈をまとめます。

## OpenAI: Agents

OpenAIのAgents SDKドキュメントでは、agentは計画、ツール利用、専門agentとの協調、状態保持を行いながらmulti-step workを完了するアプリケーションとして説明されています。

このリポジトリでの解釈:

- Goalは、agentがmulti-step workを完了するための作業契約として扱う
- Goalには、目的、入力、制約、状態、停止条件、完了条件を含める
- 実装手順よりも、agentが判断できる境界と検証可能な結果を明確にする

参照:

- [Agents SDK | OpenAI API](https://developers.openai.com/api/docs/guides/agents)

## OpenAI: Codex

OpenAIのCodex紹介では、Codexは機能実装、コードベースへの質問、バグ修正、レビュー用PR提案を行うcloud-based software engineering agentとして説明されています。各taskは分離された環境で処理され、コードの読み書き、test harness、linters、type checkersの実行ができるとされています。

このリポジトリでの解釈:

- Codex Goalは、単発のコード生成依頼ではなく、独立した実行単位として扱う
- Build / Verify Goalでは、実装と検証を同じGoalに含める
- Ship Goalでは、PR提案、検証結果、レビュー返信に必要な証跡を明示的に扱う
- Learn skillでは、レビューコメントや検証結果を次回Requirementsの入力へ整理する

参照:

- [Introducing Codex | OpenAI](https://openai.com/index/introducing-codex/)

## OpenAI: Agent Evals

OpenAIのagent evalsでは、traces、graders、datasets、eval runsを使ってagent workflowの品質を改善する考え方が説明されています。

このリポジトリでの解釈:

- Verificationは「最後にテストを走らせる」だけではなく、AI実行単位の品質を評価する材料として扱う
- Build / Verify Goalでは、検証結果を要件充足の確認に使う
- Learn skillでは、検証結果、失敗原因、残リスクを次回Requirementsの入力やルール・ポリシー更新につなげる
- 毎回ナレッジ更新するのではなく、再利用できる判断だけを恒久化する

参照:

- [Evaluate agent workflows | OpenAI API](https://developers.openai.com/api/docs/guides/agent-evals)

## OpenAI: Harness Engineering

OpenAIの「ハーネスエンジニアリング」では、agent-first な開発では人間の役割が、手作業のコーディングから、agent が信頼できる作業を行うための環境、意図、フィードバックループの設計へ移ると説明されています。

このリポジトリでの解釈:

- `AGENTS.md` は巨大なマニュアルではなく、短い目次として扱う
- `docs/` は、人間と agent が共有する記録システムとして扱う
- 設計判断、計画、生成された参照情報、技術的負債、品質情報は、agent が辿れる形でリポジトリに残す
- 強い不変条件は、ドキュメントだけでなく lint、CI、tests、scripts へ昇格する

採用判断は [Adopt Harness Engineering](../adr/0001-adopt-harness-engineering.md) にまとめる。

参照:

- [ハーネスエンジニアリング：エージェントファーストの世界における Codex の活用 | OpenAI](https://openai.com/ja-JP/index/harness-engineering/)

## Anthropic: Claude Code Overview

Claude Codeのoverviewでは、Claude Codeはコードベースを読み、ファイル編集、コマンド実行、開発ツール連携を行うagentic coding toolとして説明されています。機能実装、バグ修正、開発タスクの自動化、commitやpull request作成、instructions / skills / hooks / memoryによるカスタマイズも扱われています。

このリポジトリでの解釈:

- AI駆動開発では、コードベース探索、実装、検証、git / GitHub操作を一連のagentic workflowとして扱う
- instructions、skills、docsは、毎回のGoalを補助する共有文脈として扱う
- memory更新は明示依頼がある場合に限り、恒久ドキュメント更新とは分ける

参照:

- [Claude Code overview | Anthropic](https://code.claude.com/docs/en/overview)

## Anthropic: Claude Code Best Practices

Claude Codeのbest practicesでは、探索、計画、実装、commitのように、調査と実装を分けるworkflowが紹介されています。また、大きな機能ではClaudeに人間へ質問させ、技術実装、UI/UX、edge case、tradeoffを引き出す使い方も示されています。

このリポジトリでの解釈:

- 仕様判断を含む変更では、PRD作成とDesign Doc作成を実装から分ける
- 人間の関与は、各工程の逐次承認ではなく、意図、制約、判断基準、停止条件を与え、例外と公開可否を監督するために使う
- 小さな変更では4工程を省略してよい
- Shipはcommit / PRだけでなく、提出に必要な証跡整理を含める
- Learn skillは次回Requirementsの入力やルール・ポリシー更新に必要な学習整理を含める

参照:

- [Best practices for Claude Code | Anthropic](https://code.claude.com/docs/en/best-practices)

## このリポジトリで採用する4工程とlearn skill

一次情報をそのまま写すのではなく、このリポジトリでは次の4工程に整理します。

1. Intent / Requirements Goal
2. Design / Plan Goal
3. Build / Verify Goal
4. Ship Goal

`Ship Goal` は、Build / Verify済みの成果をPR、説明、レビュー返信ができる形に整える工程です。

`Learn skill` は、レビューコメント、検証結果、運用知見、ルール・ポリシー変更を次回Requirementsの入力へ整理する補助スキルです。次回のサイクルを回す場合は、前回の続きとして途中工程から再開せず、`$learn` で入力を整理してからIntent / Requirements Goalを設定します。

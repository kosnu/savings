---
title: AI Driven Development Overview
doc_type: overview
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - agentic-coding
  - codex-goal
  - prd
  - design-doc
when_to_read:
  - AI駆動開発の工程を確認するとき
  - Codex Goalを開発単位として使うとき
  - PRD、Design Doc、実装、提出準備、学習整理の関係を整理するとき
---

# AI Driven Development Overview

AI駆動開発では、AIに「細かい作業手順」を渡すのではなく、目的、制約、判断基準、検証可能な完了条件を渡します。

人間の役割は、詳細実装を逐一指示することではなく、次を明確にすることです。

- 何を達成したいか
- 何を変えてよく、何を変えないか
- AIが自律判断してよい範囲はどこまでか
- どの条件を満たしたら完了か
- どの条件では止まり、監督者へエスカレーションすべきか
  - 何を根拠に公開可否を判断するか

OpenAIのAgents SDKでは、agentは計画、ツール利用、専門agentとの協調、状態保持を行いながらmulti-step workを完了するアプリケーションとして説明されています。Codexも、機能実装、コードベースへの質問、バグ修正、レビュー用PR提案、テストやlintの実行を行うsoftware engineering agentとして位置づけられています。

AnthropicのClaude Codeでも、agentic codingでは探索、計画、実装、commit / PR作成を分けることが推奨されています。大きな機能ではAIに先に質問させ、人間が目的や制約を答えることで、早すぎる実装詳細化を避ける考え方が示されています。

## Human On The Loop

このフローは、各工程で人間が逐次承認するHuman in the loopではなく、AIがStop条件に当たらない限り前進し、人間が監督、例外処理、公開可否を担うHuman on the loopを前提にします。

人間は各成果物を毎回承認する gatekeeper ではありません。AIが自律的にPRD、Design Doc、実装、Shipまで進められるように、目的、制約、監督観点、停止条件を先に与えます。レビューコメントや検証結果を次回Requirementsへ整理する場合は、GoalではなくLearn skillを使います。

レビューコメントを次回Requirementsへ整理する扱いは、Requirements / PRDとDesign Docを使うAI Driven Developmentサイクルに限ります。現在のタスクに関する既存のRequirements / PRDやDesign Docを入力にしない通常タスクでは、レビューコメントごとに修正要否を判断し、必要な修正を現在のタスク内で行います。

人間が介在すると、意図よりも実装詳細に寄りやすくなります。

そのため、前半のGoalほど「ユーザー課題」「成功条件」「制約」「未決事項」を中心に書き、ファイル名、関数名、実装手順は後半に寄せます。

- Requirements / PRD Goal: 何を達成するかを決める
- Design Doc作成 Goal: どう実現するかを決める
- Build / Verify Goal: 作って検証する
- Ship Goal: Build / Verify済みの成果をPR、説明、レビュー返信ができる形に整える
- Learn skill: レビューコメント、検証結果、運用知見を次回Requirementsの入力へ整理する

IssueはRequirements / PRDの入力として扱います。Issueには、AIが要求整理を始められるだけの意図、制約、成功条件、Stop条件を書き、Design Doc相当の実装詳細は書きすぎません。

## Goalに含める要素

Goalには、最低限次を含めます。

- Goal: 何を達成するか
- Context: 背景、課題、対象ユーザー、期待する体験
- Scope: 対象範囲、対象外
- Autonomy: AIが自律的に進めてよい範囲
- Done: 完了条件
- Stop: 止まって監督者へエスカレーションすべき条件
- Verification: 検証方法
- Constraints: 守るべき制約

特に重要なのは、Autonomy / Done / Stopです。

AIに広い作業を任せるほど、作業手順ではなく「どこまで自律してよいか」「何を満たしたら完了か」「どこで止まるべきか」を明確にします。

## 参考資料

Issueの書き方は [issue-guidelines.md](./issue-guidelines.md) に、参照元とこのリポジトリでの解釈は [references.md](./references.md) にまとめています。

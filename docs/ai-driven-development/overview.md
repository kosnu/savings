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

人間は各成果物を毎回承認する gatekeeper ではありません。AIが自律的にPRD、Design Doc、実装、Shipまで進められるように、目的、制約、監督観点、停止条件を先に与えます。レビューコメントや検証結果から次回Task Contextの変更案を整理する場合は、GoalではなくLearn skillを使います。

レビューコメントを対象Issue本文の変更案へ整理する扱いは、Requirements / PRDとDesign Docを使うAI Driven Developmentサイクルに限ります。現在のタスクに関する既存のRequirements / PRDやDesign Docを入力にしない通常タスクでは、レビューコメントごとに修正要否を判断し、必要な修正を現在のタスク内で行います。

人間が介在すると、意図よりも実装詳細に寄りやすくなります。

そのため、前半のGoalほど「ユーザー課題」「成功条件」「制約」「未決事項」を中心に書き、ファイル名、関数名、実装手順は後半に寄せます。

- Requirements / PRD Goal: 何を達成するかを決める
- Design Doc作成 Goal: どう実現するかを決める
- Build / Verify Goal: 作って検証する
- Ship Goal: Build / Verify済みの成果をPR、説明、レビュー返信ができる形に整える
- Learn skill: レビューコメント、検証結果、運用知見を、対象Issue本文の変更案、ルール・ポリシーの追加・変更、または既存ルール・ポリシーのsharp化へ整理する。Issue本文の変更案は適用されるまで次のTask Contextではない

Issue本文はRequirements / PRDのTask Context正本として扱います。Issueには、AIが要求整理を始められるだけの意図、制約、成功条件、Stop条件を書き、Design Doc相当の実装詳細は書きすぎません。会話、review、現在diff、前回artifact、直前に更新されたルールをIssue本文にないTask Contextとして追加しません。

同じIssueまたはタスクで新しいサイクルを始める場合、workspaceと無印の`requirements.json`、`design.json`を再利用します。JSONは機械検証の正本であり、`requirements.md`、`design-doc.md`はJSONから生成する人間向け表示です。Issueごとのworkspaceは1つだけとし、新サイクルを理由に`v2`、`v3`、`version`、`revision`、`cycle`、`retry`、`rerun`などの派生directoryを作りません。開始時にGit `HEAD`とworktreeの両方からIssue番号で既存workspaceを探索し、1つなら必ず再利用、0件なら`<Issue番号>-<短いtitle>`で新規作成、複数なら暗黙に選ばずStopします。新しいサイクルは最新Issue本文を再取得してTask Contextを固定し、read-onlyは同一サイクルの後続工程にだけ適用します。新サイクルの各生成工程は対応するJSON正本を同じpathへ上書きし、Markdown表示を再生成します。

上書きは今回増えた内容だけを局所的に文書化することを意味しません。各生成工程は現在の上流入力全体を満たす完成版を同じcanonical pathへ作り直します。Requirements / PRDは最新Issue全体を覆い、前回の全要求項目と主要sectionをJSONの構造化fieldで状態遷移として追跡します。Design / Planは現在の各要求IDへ専用の設計・検証根拠を与え、前回Designの全sectionを維持または置換として追跡します。baselineは呼び出し側が選ばず、validatorがcanonical JSON pathのGit `HEAD`から取得します。通常validatorはMarkdown表示を解析しません。前回成果物はTask Contextではなく、欠落検出またはまだ有効な設計を維持するためにだけ参照できます。

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

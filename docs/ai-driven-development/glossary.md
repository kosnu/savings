---
title: AIDD Protocol Glossary
doc_type: reference
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - tools/aidd
  - .agents
topics:
  - ai-driven-development
  - terminology
when_to_read:
  - AIDDの用語・概念・工程の意味と境界を判断するとき
---

# AIDDプロトコル用語集

この文書はAIDDで使う概念の定義を所有する。実行条件は[workflow](workflow.md)、
保存形式と操作は[compact protocol](compact-protocol.md)と[operations](aidd-checker-operations.md)に従う。

## 意図と作業単位

### Intent

人間が達成したい結果と制約。開発サイクルの起点であり、出典と実行許可を区別して記録する。

### Issue

Intentを表現・保存できる媒体の一つ。IssueとIntentは同一ではない。
Issueの有無や本文の更新だけで新Taskや実行許可は生じない。

### Task

一つのIntentから始まる一つの開発サイクルの実行契約と記録。
目的、制約、完了条件、検証、出典、開始時のGit baselineを保持する。
同じ成果への指摘、Learn、再試行、追加Shipは同じTaskで扱う。
サイクルを終えた後の新しいIntentは次のTaskを開始する。

### サイクル

IntentからDevelopmentとShipへ進み、対象となる指摘があれば同じTask内のLearnで評価し、
採用した学びを反映するまでの開発の単位。一つのTaskが一つのサイクルに対応する。
指摘がなければLearnを行わずに終わる。学びの反映や同じ成果への再試行後、
新しいIntentから始める作業は次のサイクルとなる。
サイクルはTask IDの書式、Goal、ブランチ、PR、工程番号を定義しない。

### Goal

CodexがTaskの目的と完了条件を追跡するhost機能。実行許可やCoreの正本状態を所有しない。
Goal機能がないhostでもTask契約は同じである。工程ごとにGoalを分割しない。

### baseline

Task開始時に固定するGitの基準点。Task中の判断改訂、指摘対応、Learn、追加Shipで取り直さない。

## 作業と工程

### 工程

サイクル内の進行と反復を表す活動の区分。工程ごとにTaskやGoalを開始しない。
Explore / Decide、checkpoint、Build / Verify / Review、Shipに進み、対象となる指摘がある場合だけLearnを行う。

### Development

Intentに基づく成果の実行。Explore / Decide、checkpoint、Build / Verify / Review、Shipを含む。

### Explore / Decide

出典、既存状態、適用ルールを調べ、要求・設計・検証方法を判断する活動。

### Build

確定したDecisionの所有範囲で成果物を変更する活動。

### Verify

要求と最新Decisionに対して最終状態を検査し、結果をEvidenceに記録する活動。

### Review

最終差分、意味判断、適用ルール、検証証拠を照合し、指摘を評価する活動。

### Ship

検証済みの内容を許可された範囲へ配信し、配信状態を確認する活動。

### feedback

成果や作業に対する指摘・評価の入力。指摘の有無と妥当性を評価してLearnの対象を決める。

### Learn

同じTaskで対象となるfeedbackの原因を分析し、採用した改善を反映・検証する活動。
対象となる指摘がない場合は行わない。Learnから独立したTaskを開始しない。

## 判断、成果、検証

### guardrail

複数のTaskで再利用する判断基準、制約、検出の仕組み。feedbackの採用だけで新Intentや実行許可にはならない。

### Decision

Intentと適用guardrailを解釈し、要求、設計判断、観測可能な結果、ownership、representation、verification caseを定める記録。

### Checkpoint

Decisionを確定した追記型revision。改訂時には新revisionを作り、旧検証証拠を失効させる。

### Evidence

最新checkpointに対する検証結果と最終ソースの対応を示す記録。意味判断や実行許可の代わりにはならない。

### requirement

Intent、guardrail、または導出理由に結び付く満たすべき条件。

### ownership

最新Decisionが宣言する有限の担当範囲。ユーザーの許可範囲を広げない。

### representation

要求と観測可能な結果を具体化する担当成果物。ownership、verification caseと対応付ける。

### verification case

要求と観測可能な結果が最終状態で成立することを確認する方法。その実施結果はEvidenceに記録する。

## 実行基盤

### Core

Task、Decision、Checkpoint、Evidence、ownership、rule coverage、検証とShipの同一性を定める共通契約。

### checker

Coreの機械的整合を検査する実装。意味判断、ユーザーの許可、Goalの状態を所有しない。

### adapter

Codexなどhost固有の機能をCoreへ接続する層。Coreの契約や用語を再定義しない。

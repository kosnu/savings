---
title: Intentの記述
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - Intentの記述を判断または変更するとき
---

# Intentの記述

IssueはIntentの伝達方法の一つであり、専用の形式やIssue作成を開発の前提にしない。
[Issue template selection](../harness/policies/issue-template-selection.md)に従い、依頼の種類に合うtemplateを選ぶ。

背景、求める成果、制約、結果から判断できる完了条件、委任範囲を明確にする。
手順を指定する必要がある場合は理由を示し、それ以外の設計・道具・作業順はagentが判断する。
参考リンクの列挙を調査範囲の上限や採用指示にしない。

Intentは既存Issue本文とユーザー発言から確認する。後続の訂正はその出典と現在の採用判断へ結び付ける。
本文・hash・snapshotを専用Taskへ複製せず、必要な判断と未確認事項だけを既存Issue・PR・会話に要約する。
実行の依頼と説明・調査の依頼を区別する。
開発を委任してもAudit後の改善まで自動承認したことにはならない。

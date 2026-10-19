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
本文・hash・snapshotを専用Taskへ複製せず、必要な判断と未確認事項だけを要約し、工程結果は[Coreの記録契約](aidd-checker.md#記録)へ残す。Intent本文は複製しない。
実行の依頼と説明・調査の依頼を区別する。
開発を委任してもAudit後の改善まで自動承認したことにはならない。

## Issue本文とコメントの責務

Issue本文はIntentを伝えるために使う。進捗、調査ログ、作業・判断・検証・完了の履歴は、要約を含め、本文へ追記・上書きしてはならない。
これらをIssueに残す場合はコメントに記載する。引き継ぎや再開に必要な情報であっても、本文を履歴の保存先にしない。
目的・制約・完了条件などIntent自体の変更は、既存の承認・権限の範囲で扱い、履歴の記録と区別する。

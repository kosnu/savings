---
title: AIDD v4の変更範囲とレビュー
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
  - AIDD v4の変更範囲とレビューを判断または変更するとき
---

# AIDD v4の変更範囲とレビュー

変更の意味から、正本、索引、実装、CLI、host入口、CI、検証のうち同期が必要な面を判断する。
全Taskに固定の台帳やID体系を要求しない。判断した範囲と省略理由はdecisionまたはreviewに残す。

rule-mapはpath/surfaceの必須正本と依存closureを選択する。rule本文の意味まで自動適用したとは扱わない。
ADRで決めた現行の条件は責務ある正本へ反映し、対象pathがその正本へ到達することを確認する。
旧ADRとの置換関係は履歴上に残す。`overrides`は現行正本間に実際の競合がある場合だけ使う。
履歴だけのADRやTaskを現行実装に合わせて書き換えない。

代表pathの選択結果、実際の呼出経路、旧実装への残存参照を確認し、
[レビュー形式](../harness/policies/code-review.md#レビュー結果)で適用規則と未解決事項を記録する。

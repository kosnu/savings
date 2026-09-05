---
title: AI Driven Development Issue Guidelines
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - tools/aidd
  - apps
topics:
  - ai-driven-development
when_to_read:
  - AIDDの実行契約と責務を確認するとき
---

# Issueの責務

Issueは人間がagentへ委任するintent、problem、desired outcomeの正本である。
背景、期待する結果、scope、制約、成功条件、任せる範囲を必要な精度で記載する。
実装ファイル、関数名、詳細手順、rule-mapと同じ語句の記載を必須にしない。

agentはrepositoryとguardrailを探索してTask contractとDecisionへ具体化する。
Issueが技術的な設計詳細を持たないことだけを停止理由にしない。
意図や受け入れ条件が複数に解釈でき、選択で成果が変わる場合は不足点を確認する。

技術選択、検証profile、representationはDecisionが所有する。新しいproduct intentは
既存Issueへ明示反映し、別Developmentから実装する。Learn用Issueは作らない。
Feature Request / Bug / Taskのテンプレート種別は意図を表すために選び、AIDD利用の選択肢にはしない。

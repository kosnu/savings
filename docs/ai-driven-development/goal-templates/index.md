---
title: Codex Goal Templates
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

# Goal templates

Codex adapterは1つのDevelopment Goal、または独立したLearn Goalを作成する。

- Objective: 今回の作業の達成結果。
- Constraints: 許可範囲、guardrail、product/Learn境界。
- Done: Developmentでは成果・検証・review・commit・push・PR作成または更新と配信状態の確認。
  ユーザーの明示制限がある場合だけ完了地点を狭める。Learnでは独立した検証・review・確定。
- Verification: 必要な検証とTask contractへの参照。

Task identityを参照し、decision、hash一覧、inventory、進捗を本文へ重複させない。
Requirements / Design / Build / Shipのphase Goalは新規作成しない。
Goal機能がなくてもTask contractは必須である。

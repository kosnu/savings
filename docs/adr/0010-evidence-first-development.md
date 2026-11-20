---
title: ADR 0010 実差分から検証を選び、工程記録を引き継ぎに限る
doc_type: adr
status: accepted
area: repository
applies_to:
  - tools/harness/checker
  - docs/ai-driven-development
topics:
  - harness
  - verification
when_to_read:
  - 開発の検証入力と引き継ぎの境界を変更するとき
---

# ADR 0010 実差分から検証を選び、工程記録を引き継ぎに限る

## Context

[PR #2172](https://github.com/kosnu/savings/pull/2172) は文書配置を整理した。差分・テスト・PRのほかに設計、検証、レビューの3件をcommitした。Checker自身が必須規約とコマンドを計算できるにもかかわらず、実行側にも同じ情報を入力させていた。

OpenAIはリポジトリ内の知識への入口と機械検査を整えた。Lauren Tanは繰り返す誤りを発見した際に、コードや実行可能な検査でその誤りを防ぐ設計を紹介した。Anthropicの長時間タスクでは、新しいセッションが成果と残作業を特定できる引き継ぎが重要だった。[OpenAIの実践](https://openai.com/index/harness-engineering/)・[Lauren Tanの講演](https://ai.engineer/code/2026/talks/lauren-tan)・[Anthropicの実験](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents)

## Decision

[ADR 0009の工程記録](0009-rebuild-aidd-v4.md)を全開発に適用する前提を改める。通常の作業では、委任時に定めた比較元と対象範囲を入力に、Coreが実差分から規約本文と必須コマンドを選ぶ。agentは規約を適用し、Intentの完了条件に足りない観測を加える。結果は既存のPRまたは会話で示す。

別セッションで既存の参照だけでは判断や残作業を復元できない場合は、Coreの短い工程記録を使う。開始済みの記録サイクルは既存形式で継続する。権限と承認は元の依頼で確認する。

## Consequences

単一セッションで完結する変更は工程ファイルも規約IDの転記も必要としない。差分を委任範囲と取り違えないよう、範囲外の変更は検証を実行する前に拒否する。既存の計画入力や記録を移行する作業は発生しない。

コマンドの成功が証明する範囲は各コマンドが観測した挙動に限られる。画面操作や追加の受け入れ条件はagentが個別に確かめる。[実行契約](../ai-driven-development/workflow.md)と[操作例](../ai-driven-development/aidd-checker-operations.md#検証)を正本とする。

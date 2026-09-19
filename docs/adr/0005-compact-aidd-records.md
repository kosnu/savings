---
title: Compact AIDD Records
doc_type: adr
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - schema-v6
when_to_read:
  - AIDDの記録方式とagent入出力を変更するとき
---

# ADR-0005: AIDDの記録とagent入出力を小型化する

## Status

Accepted 2026-09-19. Issue #1765の再設計と実行依頼に基づく。
ADR-0003/0004の不変条件を維持し、保存方式とagentの通常入力経路を具体化する。

## Context

Taskの開始状態、checkpointのrule-map、Evidenceの全inventoryを反復保存すると、
変更規模に比べて大きなJSONになる。checkerによる自動生成自体はモデルtokenではないが、
全文読込とDecisionの反復入力はagentの負担になる。保存量とモデル入出力を分けて改善する。

## Decision

新規Taskはschema v6を使い、開始時inventoryとpolicy/rule-map/profileは固定Git commitから復元する。
Gitが保持しないローカル権限例外、意図、許可、完了条件はTaskに残す。既存v5記録のbytes/hashと検査は保持する。
checkpointは完全な判断snapshotと親・Taskへの結合を維持し、変更分入力からcheckerが構成する。
rule-mapは開始時参照またはTask内で一度保存する内容hash付きsnapshotとし、過去revisionの解釈を維持する。
証跡は全ソース走査から得るローカル/Git状態digest、変更path、構造化runner結果を保持する。
全inventory配列の反復保存を省いてもownership・mode・未追跡file・staged・CI・履歴の検査を省かない。
短い状態表示と明示Task/期待revisionによるidentity解決を通常入口とし、詳細は明示取得する。
保証、旧Taskのchecker固定、既存の非互換契約移行境界を変更しない。

## Consequences

通常権限の未変更fileが増えても、Task/Evidenceの保存量と通常入出力は比例増加しない。
必要なGit履歴とsnapshotの取得を前提とし、参照を解決できなければ失敗する。Git復元の処理負担は増える。
JSONの行数削減だけをtoken・速度改善の証拠にせず、保存量・入力・出力・往復数を別々に計測する。
仕様と測定方法は[compact protocol](../ai-driven-development/compact-protocol.md)が所有する。

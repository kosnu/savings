---
title: Separate Intent from Issue representation
doc_type: adr
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
  - docs/harness
  - .agents
topics:
  - ai-driven-development
  - intent
  - task-scope
when_to_read:
  - Issueの有無とIntentの出典・補足の関係を判断するとき
---

# ADR-0006: IntentとIssueによる表現を分離する

## Context

[Issue #1800](https://github.com/kosnu/savings/issues/1800)では、IssueなしのLearnを認めながら、
product実装や意図の補足をIssue前提で扱う契約の矛盾が指摘された。
人間のIntentはIssueの有無によらず存在し、Issueはその表現・保存方法の一つである。
意図の不足や解釈違いが後から明示された場合も、出典と変更経緯を同じTaskで保持する必要がある。

## Decision

[ADR-0003](0003-adopt-aidd-invariant-protocol.md)のDevelopment入口をIssue指定に限定する前提を置き換える。
[ADR-0004](0004-separate-task-scope-from-work-kind.md)の、許可された目的と担当範囲でTaskを継続する判断を維持する。

- Issue本文とユーザーの明示発言をIntentの出典として受け入れ、参照・本文・hashを保持する。
- Task開始記録を固定し、補足・訂正は新checkpointへ出典付きで追記する。要求は解釈の根拠となる出典を参照する。
- 同じ成果への修正は元Task・baselineを保持して継続する。Issueの有無やDevelopment / Learnの呼称を分割理由にしない。
- Intentの存在・補足と実行許可を分ける。質問や分析を実装依頼へ読み替えず、Learnでのproduct実装には明示許可と有限scopeを記録する。
- 出典の真正性、要求との意味的な対応、独立した新規作業との境界はagentが確認する。Coreは保存記録と許可・出典参照の整合を検査する。

## Consequences

IssueなしのDevelopmentでも実行依頼と出典を記録でき、継続のためだけのIssue作成は不要になる。
Issueを正本として使う場合は許可された変更をIssue本文にも同期する。現行契約は[workflow](../ai-driven-development/workflow.md)が所有する。

元Task・過去checkpoint・検証履歴は上書きせず、新checkpointで旧証拠を失効して全体を再検証する。
新fieldを省略した既存v5/v6記録のbytesとhashは維持する。新しい出典記録を使うには対応checkerが必要であり、
開始時checkerの暗黙の差し替えは認めない。旧Taskの実行binary変更には既存の明示的な移行契約を適用する。

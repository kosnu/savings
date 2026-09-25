---
title: AIDD v4 Core
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - aidd-v4
when_to_read:
  - AIDD v4 Coreを実行または変更するとき
---

# AIDD v4 Core

CoreはGoで実装するローカルCLI。Goalや特定モデル、外部Evalsサービスには依存しない。
意味判断と人間の承認を行うagent/hostから独立して、記録と実状態の一致を検査する。
[操作](aidd-checker-operations.md)と[workflow](workflow.md)を併用する。

## 記録

`.aidd/v4/<task-id>/task.json`は開始Intent、実行権限、baseline、開始時snapshotを保持する。
`events/000001.json`以降は追記専用。Task hash、前event hash、連番、decision revision、
対象snapshotのfingerprintを結び付ける。確定した判断の変更は新decisionで行い、旧証拠は失効する。
旧`.aidd/tasks`のschemaや旧CLIを読み替える互換経路はない。

開始時に既存差分があれば、明示的なacknowledgementと実際の初期差分を保存する。
これは他者の変更を自分の成果にする権限ではない。baselineからの全差分を後続scope検査に含める。
通常は専用のclean worktreeで開始する。v4自身の初回構築では、起動に必要だったCore差分を
初期差分として記録し、clean開始だったと偽らない。

## 検証

Gitのtrackedとnon-ignored untrackedを対象に内容hashとmodeを取得する。
自身のTask記録は循環参照を避けるためsource fingerprintから除外し、hash chainとstage状態で別途確認する。
他Taskの記録やファイルは無視しない。担当path外のbaseline差分、古いrevisionやsnapshotに結び付いた証拠を拒否する。

検証commandはargv配列で指定し、shell展開を暗黙にしない。実行終了状態と出力を保存する。
macOS/Linuxでは検証を専用process groupで実行し、親終了後の出力待ちは1秒までとする。
残存processは終了させ、待機超過・残存・後始末の失敗をverify証拠へ失敗として保存する。
通常の検証実行時間は制限しない。process groupから意図的に離脱するdaemonの管理は対象外。未対応OSでは実行前に拒否する。
実行前後にsourceが変わった場合は成功にしない。formatter等は検証batchの前に実行する。
Go/Core、Webなどの必要commandを変更pathから確認する。意味的な適用条件はAGENTSと関連policyを読み判断する。

意味評価にはIntentの各完了条件、具体的根拠、pass/fail/unknown、適用rule集合を記録する。
Goは記録とidentityを検査するが、根拠の内容が正しいことを認証しない。
Ship前には検証・reviewが最新であることと、indexのcontent/modeが検証したworktreeと一致することを確認する。
実際のcommit、remote ref、PR headと期待するbaseブランチ名も確認する。baseのSHAは固定・照合しない。CI待機やmerge/deployは行わない。

## Auditと承認

AuditはShipされた内容に結び付き、指摘とセッション改善を記録する。
提案ごとに根拠・具体案・対象pathを保存する。提案がなくても承認待ちとなる。空の提案一覧または全提案の明示却下だけではcompleteにしない。
提案のないAuditの明示承認でcompleteとなるが、実装権限は付与しない。
同じShip内容・revisionへの追加Auditはaudit-updateイベントで保存し、新しいAudit hashへの承認を要求する。
承認は最新Audit hash、提案ID、ユーザー発言の出典と本文に結び付ける。
承認前の変更や対象外の変更を拒否する。元の開発権限の転用は許可しない。
承認後は新decision、変更、検証、review、必要なShip、結果のAuditを同じTaskで記録する。
一部だけ承認した場合、残る案は次Auditへ保持する。明示的な却下はdismissとして記録し、
承認待ちを消すためにagentが却下を捏造しない。Intent自体の改訂は承認対象`@intent`と
新しい出典を持つdecisionの`intent_revision`で扱い、開始Intentを上書きしない。

## CIと信頼境界

CIはv4 Coreのテスト、vet、format、ADR履歴、rule graphと記録を検証する。
PR headの検証とmerge結果でのCoreテストを分ける。
GitHubが署名検証したRenovate authored / web-flow committedのcommitだけを含む自動依存更新は
人間がIntentを委任した開発ではないためTask証拠検査の対象外とする。author名だけでは除外せず、
Coreテストと記録・rule graph検査は省略しない。旧migration checkerやschema fallbackは実行しない。
新Core自身の変更は負の境界テストと実差分レビューで補う。candidate内のcheckerは、悪意ある変更を
自身だけで認証できない。GitHubのreview・branch protectionとhostの権限制御を信頼境界とする。

Coreは信頼されたローカル操作者、専用worktree、単一writerを前提とする。
記録を手で改ざんする攻撃や同時writerを防ぐsandboxではない。hash chainは不整合を検出するが署名ではない。
ユーザー承認の真正性・意味はhostと担当agentが確認する。文字列を入力できることを承認権限にしない。
環境、外部サービス、意味評価の誤差はsource hashだけでは再現できないため、必要な観測条件をreviewに残す。

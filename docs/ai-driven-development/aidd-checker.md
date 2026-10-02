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
対象snapshotのfingerprintとcycle IDを結び付ける。確定した判断の変更は新decisionで行い、旧証拠は失効する。
旧`.aidd/tasks`のschemaや旧CLIを読み替える互換経路はない。

開始時に既存差分があれば、明示的なacknowledgementと実際の初期差分を保存する。
これは他者の変更を自分の成果にする権限ではない。baselineからの全差分を後続scope検査に含める。
通常は専用のclean worktreeで開始する。v4自身の初回構築では、起動に必要だったCore差分を
初期差分として記録し、clean開始だったと偽らない。

## サイクル記録

新Taskのstart eventに`<task-id>/cycle-0001`を付け、以降のeventは同じIDに所属する。
`return-intent`は承認後の改善判断と対象範囲を確認し、再確認の要約・現在Intentのhash・承認hash・直前cycle IDを保存する。
このeventで前の一巡を閉じ、次の一巡のIDを発行する。同一サイクル内のdecisionやverifyの繰り返しでは発行しない。
復帰後は新cycleのdecisionが必要で、前cycleの検証・review・Shipを次cycleの証拠として流用できない。
Goが確認するのは記録の一致であり、Intentやガードレールを実際に理解したかは意味評価で確認する。

ID導入前のv4 eventは追記専用の履歴として保持し、過去のサイクルを推定して書き換えない。
そのTaskは明示的な`return-intent`からcycle-0001を開始する。この番号は記録開始後の連番であり、過去の一巡の回数を表さない。
ID導入後の欠落・飛び番・境界外の切替を拒否する。旧`.aidd/tasks`を実行入力へ戻す互換処理ではない。

## 検証

Gitのtrackedとnon-ignored untrackedを対象に内容hashとmodeを取得する。
自身のTask記録は循環参照を避けるためsource fingerprintから除外し、hash chainとstage状態で別途確認する。
他Taskの記録やファイルは無視しない。担当path外のbaseline差分、古いrevisionやsnapshotに結び付いた証拠を拒否する。

検証commandは入力時にargv配列で指定し、shell展開を暗黙にしない。
Coreは実行argvとstdout/stderr・実行エラーをGit common directory内の`aidd-evidence/<task-id>/`へ保存する。
directoryは0700、証拠fileは0600とし、公開snapshotやcommitへ含めない。
公開decisionは`evidence_version: 1`、command IDの列と実行planのhashを保持し、argvを持たない。
command IDはargvのJSON hashとし、必須commandはrepositoryの定義から同じIDを導いて照合する。
既存の`go test -count=1`の正規化だけを維持し、実行するplan全体は別hashで結び付ける。
公開verifyはversion、各command ID・終了code・ローカル証拠のhash、sourceの安定性だけを保持する。
生出力や自由記述の検証要約を公開verifyへ保存しない。実行planを失った場合は検証を再開できず、成功扱いしない。
macOS/Linuxでは検証を専用process groupで実行し、親終了後の出力待ちは1秒までとする。
残存processは終了させ、待機超過・残存・後始末の失敗を公開verifyの終了codeと非公開の詳細証拠へ保存する。
通常の検証実行時間は制限しない。process groupから意図的に離脱するdaemonの管理は対象外。未対応OSでは実行前に拒否する。
実行前後にsourceが変わった場合は成功にしない。formatter等は検証batchの前に実行する。
Go/Core、Webなどの必要commandを変更pathから確認する。意味的な適用条件はAGENTSと関連policyを読み判断する。

公開decision/verifyの保存時とShip前、CIの`check-all --base`が扱う変更Taskで、同じ公開schema validatorを適用する。
未許可field、大小文字alias、重複key、不正hash、未宣言command ID、旧形式を公開時に拒否する。
hash chainが整合していても公開schemaの違反を許可しない。CIの照合にローカルの実行詳細は要求しない。
無関係な旧Taskは読取を維持するが、再配信対象Taskの旧decision/verifyを互換性だけで通さない。
その公開移行は非公開原本の保全と対象を特定した例外承認を要し、通常の追記専用規則を変えない。
この境界が保証するのは検証の実行argv・生出力を公開記録に保存しないこと。
TaskのIntentや意味レビュー等の自由記述全般の内容、実行の真正性、過去のGit commitからの情報消去は保証しない。

意味評価にはIntentの各完了条件、具体的根拠、pass/fail/unknown、適用rule集合を記録する。
Goは記録とidentityを検査するが、根拠の内容が正しいことを認証しない。
Ship前には検証・reviewが最新であることと、indexのcontent/modeが検証したworktreeと一致することを確認する。
実際のcommit、remote ref、PR headと期待するbaseブランチ名も確認する。baseのSHAは固定・照合しない。Ship照合は読み取り専用で、結果だけを返す。CI待機やmerge/deployは行わない。

## Auditと承認

Ship後の状態はTask記録だけからは確定しない。再開時にはPRとcommitを確認する。Coreの状態はAudit開始の権限を付与しない。
Auditは指定された配信対象のreview済みcommitとPRを照合する。改善提案がない場合は結果を報告し、eventを追加しない。
改善提案ごとに根拠・具体案・対象pathを保存し、承認と改善の変更を同じcommitに含める。空の提案一覧または全提案の明示却下だけでは改善権限を付与しない。
旧Taskに残る提案なしAuditと承認eventは読み取りを維持する。
新しい承認・却下の入力本文は保存時に`text_hash`へ置き換える。本文を持つ旧承認記録も読み取りを維持する。
同じShip内容・revisionへの追加Auditはaudit-updateイベントで保存し、新しいAudit hashへの承認を要求する。
承認は最新Audit hash、提案ID、ユーザー発言の出典と本文に結び付ける。
承認前の変更や対象外の変更を拒否する。元の開発権限の転用は許可しない。
承認後は改善の新decisionと変更を同じサイクルで記録する。改善後に`return-intent`で次サイクルへ移り、
Intentと改善済みガードレールに基づく新decision、必要な実装、検証、review、Shipを同じTaskで記録する。次のAuditは手動開始後に記録する。
承認だけでは提案を解決済みにしない。承認後の新decisionがないShip、および旧revisionの検証・reviewを使ったShipを拒否する。
承認された提案は、Intent復帰後の新revisionの検証・review・Shipと、その後の手動Auditで結果を確認するまで保持する。
Intent復帰とShipでは、承認の基準となったAudit対象のcommitから、承認pathに実差分があることを要求する。
再Shipしても比較元は変えない。`@intent`だけの改善では、出典だけの変更を除くIntent本文・目的・制約・完了条件の改訂を要求する。
作業開始前のdecisionや途中のscope検査では実差分を要求しない。差分の存在は改善内容の妥当性を保証せず、意味評価で各提案への対応を確認する。
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

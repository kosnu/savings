---
title: AIDD vNext migration record
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - migration
when_to_read:
  - vNext移行の実装判断と検証状況を確認するとき
---

# AIDD vNext migration

2026-09-05、初回ローカル検証の後に設計との差分を再監査し、完了判定を訂正した。
追加修正を実装し、下記のローカル回帰検証、実Codex入口評価、独立agent最終reviewを行った。
移行管理のCodex Goalは1件で継続したが、初回の完了判定は早計だった。
是正時のget_goalはnullで、再開toolがないためGoalを増やさず同じ契約を継続する。新規Developmentで提供する1 Goal adapterとは別の作業単位である。
この移行はユーザーが旧phase契約・executor・Learn境界の置換を明示許可したbootstrapであり、
通常のDevelopmentとして自身のguardrailを変更したものではない。product変更は含まない。

## 実装項目

- [x] vendor-neutral Task / Decision / Checkpoint / Evidence契約と公開CLI。
- [x] baselineの固定、追記型decision改訂、古い証拠の失効。
- [x] 既存target / ownership / rule closure / runner / staged検査の再利用。
- [x] Developmentのguardrail不変とIssue不要Learnの基準checker・独立review境界。
- [x] Codex adapterへのGoal / Hooks / 委譲責務の分離と1 Goalの入口。
- [x] rule-map、docs、skills、設定、CI、新ADRの同期。
- [x] 新旧protocol境界、正常系と拒否系の回帰test、最終review。

## 設計と実装の対応

| 採用設計 | 実装・責務 |
| --- | --- |
| Issueはauthoritative intent | Task Specの出典本文・hashと実行action。既存Issueの取得・実行依頼の判別はadapter |
| Taskは作業契約 | `protocol/model.go`, `task.go`。objective/constraints/Done/verification、固定baselineと開始時policy/profile/checker |
| 要求と設計の反復 | `decision.go`。要求の根拠、behavior/verification/representation、ownershipを同じDecisionで管理 |
| checkpointと改訂 | Task hash・親hash・revisionを追記。旧revision、rule不足、guardrail driftを拒否。baseline再取得なし |
| 検証証拠 | `verification.go`。最新checkpoint、全repository inventory/content/mode、固定profile、実行結果へ結合 |
| agent非依存Core | `internal/protocol`と`verificationcontract`。Goal/Hook/modelへの依存なし |
| 単一Development Goal | Codex adapter文書・aidd-cycle・goal-setting。工程Goalを廃止し、Goal不在でも同じTaskで継続 |
| 独立Learn | 旧policyで許可scopeとproduct除外を検査。開始時binaryを必須化し、最新証拠への独立reviewをfinish/Shipで要求 |
| rule-map | ownership・representation・実差分からpath/surface/depends_onを和集合。探索metadataやpriorityで必須ruleを除外しない |
| Ship / CI | 検証済みworktreeとindexのcontent/mode照合。commit後はbase checkerがGit baselineとcandidate evidenceを検査 |
| 設定の整合 | `check-config`でpolicy glob・必須suite・rule-map・正本文書参照を検査。`check-all`と通常検証も適用 |
| 採択判断 | 新規ADR 0003。ADR 0001/0002の履歴を保持し、旧phase結合部分の置換関係を明示 |

## 維持した保証と回帰検証

`tools/aidd/checker/internal/protocol/`の一時Git repository testと既存testを実行した。

| 保証 | 主な回帰test |
| --- | --- |
| ownership外の変更を拒否 | `TestRejectsChangesOutsideOwnership` |
| surface/pathのrule closure不足を拒否 | `TestRuleClosureCannotBeOmitted`、既存rules/coverage/gates tests |
| guardrailの変更をDevelopmentへ取り込めない | `TestGuardrailDriftCannotBeAbsorbedByRevision`, `TestGuardrailCannotBeOwnedByDevelopment` |
| decision改訂で旧証拠を失効 | `TestDecisionRevisionInvalidatesEvidenceAndPreservesBaseline` |
| baselineの取り直し・先行commitで差分を隠せない | `TestBaselineCannotBeRetaken`, `TestDeliveryCannotHideEarlierCommits` |
| 検証対象のcontent/mode driftを拒否 | `TestEvidenceRejectsContentAndModeDrift` |
| artifact整合性 | `TestTaskArtifactDrift`, `TestRejectsEvidenceForUnknownCheckpoint`、既存canonical/repository tests |
| staged content/mode不一致・余分なpathを拒否 | `TestShipRejectsStagedMismatchAndExtraPath`, `TestCommittedDeliveryUsesGitContentAndMode` |
| Learnのproduct混入を拒否 | `TestLearnRejectsProductChanges` |
| Learnが更新後checkerだけで自己正当化できない | `TestLearnNeedsBaselineCheckerAndIndependentReview`。開始時binary必須、reviewなしlocal完了も拒否 |
| 必須検証をmanual宣言で代替できない | `TestRequiredVerificationCannotBeManualOnly` |
| 設定不整合を拒否 | `TestConfigurationRejectsBrokenReferences` |
| Goal/Hookなし・旧phase非依存の正常系 | `TestDevelopmentWithoutGoalOrHook`, `TestPublicCLIEndToEnd` |
| 質問・説明・調査では開始しない | `TestReadOnlyRequestCannotStart`と実Codexの実行依頼/質問評価 |
| 正常なpackage/lock更新と継続 | `TestLockfileTracksProductAndToolClosure`, `TestLockfileDelegatesOnlyRootCoveredPeers`, `TestSameTaskContinuesAfterCommitAndReviewRevision` |
| Storybookの検証coverage | `TestStorybookCoverageSeesRemovedAndNewTags`。suite有無とtag削除・追加を検査 |
| bootstrap独立reviewと差分結合 | `bootstrap_test.go`の記録欠落・content/mode drift・既存v5迂回の拒否 |
| runtime/argv/output/process/ignored mutation | 既存runner/evidence/repository/CLIの回帰testを共有入力経由で維持 |

現行repository全体を一時repositoryへ複製したLearn smokeも実行した。
公開CLIでtask-start → checkpoint → verify → reviewなしfinish拒否 → learn-review → finish →
ship-check → commit → ci-checkが通過した。review入力は明示した合成test fixtureであり、
実際の移行に対する第三者承認とは扱わない。識別hashは別添の検証記録へ保存した。

## 検証結果

すべてローカルで実行。Go cacheは書込可能な`GOCACHE=/tmp/aidd-vnext-go-cache`を指定した。

| command / 検査 | 結果 |
| --- | --- |
| `go test -C tools/aidd/checker ./...` | 全package成功。新Core、公開CLI、Codex Hooks、旧保証の回帰testを含む |
| `go vet -C tools/aidd/checker ./...` | 成功 |
| `go mod verify -C tools/aidd/checker` | all modules verified |
| `gofmt -l tools/aidd/checker` | 出力なし |
| `go build -C tools/aidd/checker -o /tmp/aidd-vnext-candidate ./cmd/aidd-checker` | 成功 |
| `/tmp/aidd-vnext-candidate check-all --repo-root .` | 設定整合成功、artifacts=8、read_only_legacy=2 |
| `python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/main` | 成功、既存採択済みADR 2件の履歴を保持 |
| skill-creatorの`quick_validate.py` | aidd-cycle / goal-setting / learn / harness-taskの4件成功 |
| Codex TOML / Hooks JSON / workflow・skill YAML parse | 成功 |
| 実Codexの自然言語入口 | 実行依頼と質問の2ケース成功。Goal不在を明示し、product実装前で停止 |
| `bootstrap-check --repo-root . --base <migration-base>` | 独立review対象manifestとの一致を検査 |
| 現行repository設定でのLearn smoke | 公開CLIとGit転送検査が成功 |
| `git diff --check` | 成功 |
| `git diff --name-only -- apps/web apps/api` | 出力なし。Web/API product変更なし |

## 最終review

Checked rules: `ai-driven.overview`, `ai-driven.workflow`, `ai-driven.issue-guidelines`,
`ai-driven.goal-templates`, `ai-driven.checker`, `ai-driven.learn`, `documentation.policy`,
`policy.code-review`, `policy.git-workflow`, `policy.learning-extraction`,
`policy.review-feedback-classification`, `adr.harness-engineering`, `adr.agent-rule-graph`,
`adr.aidd-invariant-protocol`。

Coreの呼出経路、旧共有検証との差分、adapter、公開CLI、rule-map、CI、正本文書の整合を確認した。
最終reviewで、設定参照検査の不足、履歴artifactのHook対象への混入、不明checkpointの証拠参照、
旧Build用文言とharness-taskのLearn迂回記述を修正し、影響する検証を再実行した。
この初回reviewは主agentが実施し、後続監査で下記の漏れを確認した。
追加の独立agent reviewは`/root/independent_review`が実施した。混在package・lockfile、
commit後の継続、Storybook必須suite、bootstrap CIを再検査し、lockfileで見つかった
通常依存の除外とlocal/file依存の無検査成功を修正した。独立review記録は
[vnext-bootstrap.json](vnext-bootstrap.json)に対象差分manifestと結合して保存する。
これは人間の第三者承認やGitHub上の承認を意味しない。

## 廃止・簡素化と移行状態

- 新規実行の公開CLIはschema v5のみ。phase順序・固定executor・assignment contract・工程Goal templateを廃止した。
- 旧v2/v3/v4 artifactは保存し、読取・表示同期・回帰検証用に限定する。新しいcheckpoint/evidenceへ自動変換しない。
- 旧実行CLIは明示的に拒否する。古い実行を新protocolへ混在再開せず、履歴を保存して新Taskから始める。
- Hooksはadapterへ移動した。compact時の再提示と制御面の早期検証に限定し、Core成立の条件にはしない。
- repositoryのデフォルト入口と設定はvNextへ更新済み。この作業のcommit/push/PR公開は行っていない。

## 残る制約・未実施事項

- 専用clean worktree、単一writer、1 PR=1 task、Task baseline=PR merge-baseが前提。同じTask内の複数commitとreview後の改訂・再検証に対応する。
- decision改訂後は全caseを再実行する。部分証拠再利用、並行writer、複数taskのPR合成は未対応。
- Goal toolがないagentでもCLIを使える。自然言語の依頼分類、意味的review、委任権限はadapter/agentが担う。
- hashは署名ではない。信頼された開始時checker/Git/OSを前提とし、独立reviewの確認者・権限を暗号的に認証しない。
- 初回移行PRのbaseにはv5がないためbootstrapとなる。既存v5 checkerによる移行自身の検証済みとは主張しない。
- GitHub Actionsの実際のremote実行、branch protection、別vendor agent、Codex Goalによる長時間継続の運用評価は未実施。
- 実Codex入口評価は公式CLI 0.153.3 / gpt-6-astra、完全なIssue snapshotを与えた一時repositoryで実施した。GitHub取得のend-to-end検証ではない。実行依頼はTask/checkpointを作成し、質問は作成も変更もしなかった。評価CLIではGoal toolが利用できず、Goalを作成したとは扱わない。
- pnpm lockfile v9のみ対応。保護closure内のlocal/file依存は未対応として拒否する。意味的な依存分類と動的Storybook tag・共有componentへの影響判断はagent reviewが補う。
- Web/APIは変更していないためapp検証は対象外。これをapp検証成功とは扱わない。

## 検証記録の責務

[vnext-verification.json](vnext-verification.json)は今回のbootstrap移行のローカル検証記録であり、
v5 Task/checkpoint/evidenceの代替入力ではない。schema_version=1、kind=aidd_migration_verification。
基準HEAD、変更fileのcontent/mode・削除、manifest hash、checker binary hash、実行check、smoke identityを保存する。
循環hashを避けるためbootstrap/verificationの2つのJSONだけをmanifestから除外する。
本migration文書を含む実装・設定・正本文書を変えた場合は
影響検証とmanifestを更新し、実行していないcheckをpassedへ変更しない。

## 追加監査と是正

| 初回の不足 | 是正と検証 |
| --- | --- |
| 混在設定のファイル全体保護 | package JSON Pointerでproductとguardrailを分離。独立Vite build設定はproduct分類。mixed正常系・tool変更拒否・Learn product拒否 |
| lockfileとの同期不足 | pnpm v9のroot/解決package/snapshot closureを検査。product/tool更新の正常系と他方の変更・推移依存変更を拒否 |
| commit後の同Task継続不可 | baselineと検証時HEADを分離。二度のShipとdecision改訂、commit済みownership逸脱の拒否 |
| 初回bootstrapのreview不在 | bootstrap-checkで独立review記録の欠落・対象差分content/mode drift・既存v5迂回を拒否 |
| Storybook必須検証漏れ | 変更前後のtagを検査し、tag除去・file削除・追加もsuite必須 |
| 実Codex入口未検証 | 公式CLIで実行依頼→Task/checkpoint作成、質問→未開始・無変更を実ファイルと実行ログで確認 |

新しいYAML解析にはsecurity-fixが継続される安定版go.yaml.in/yaml/v3 v3.0.4を固定使用する。
v4は確認時点でRCのため採用していない。[提供元の互換性方針](https://github.com/yaml/go-yaml)。
lockfile parserはv9のみ対応し、未知形式・参照欠落を成功扱いにしない。

## PR #1706 follow-up (2026-09-05)

ユーザーの追加指摘2件を原因調査し、症状と制御不全の分類、およびhard routingの過剰適用を修正した。

- feedbackは対応前に妥当性・原因を評価する。local defectという症状だけで原因評価を終えず、
  policy、routing・読込・適用、検出機構、guidanceを調べる。purely localは同Developmentで修正し、
  再利用可能な制御不全は独立Learnへ渡す。design issue等でもLearnを優先し、依存Developmentを中断する。
- `docs/**` / `.github/**`の一括surfaceはこの移行で追加されたもので、移行前のgoverned surfaceはWeb/APIのみだった。
  guardrailの変更面を取りこぼさない意図の一括分類だったが、immutabilityの保護範囲とrule適用範囲を混同していた。
  AIDD/harness、採択ADR、agent入口・設定、AIDD専用CIへ限定した。`.github/skills/code-review/**`、
  `.github/agents/**`、`CLAUDE.md`は実際のagent guidance入口として残す。
- 既存`ai-driven.workflow.applies_to.paths`の`docs/**/*.md`も一般文書への過剰一致を生むため除去した。
  一般Markdownのdocumentation規則、Issue templateのissue規則、通常CIのtransaction規則は
  direct matchとdepends_on closureで維持する。priority・探索metadataによる除外は導入していない。
  guardrail_pathsを縮小したものではない。
- 実rule-mapを使う正負のrouting回帰テスト、surface未分類拒否、低priority依存の保持、
  metadata非強制を追加した。resolverの実装は変更せず、適用契約とその検証を修正した。
- 必須全Go suiteで、旧Goal表を現行workflowへ要求する移行漏れを発見した。移行前commitの12行を
  semantic testdataへそのまま保存し、旧契約との照合をこの固定fixtureへ移した。既存の欠落・改変・順序拒否は維持する。
  cached成功だけではこの漏れを見つけられなかったため、最終全Go suiteは`go -C tools/aidd/checker test -count=1 ./...`で再実行した。

PR全体は依然としてbaseにv5がないbootstrapである。今回の独立Learnは同じsource HEAD
`de69aaa394c9be17ade122aa21efa365762d53a4`の一時repositoryで開始し、同じsourceからbuildした
開始時checkerと旧policy/profileを保持して検証する。
最初の有限scopeでは上記legacy test修正を含められなかったため、失敗Taskを保存し、同じsource HEADから
必要8filesを明示したTaskへ切り替えた。未検証変更を新baselineへ取り込んでいない。Goalは追加していない。
一時Learnの証拠とmain worktreeの8filesのcontent/mode一致を別添検証記録へ保存し、
PR全体のbootstrap review manifestも更新する。commit/push/remote CIはこの追加修正では実行していない。

## PR #1706 review comments (2026-09-05)

未解決のレビュー4件は、いずれも機械的なguardrail検査の不足として対応する。
コードコメントの言語変更だけを目的とする修正は含めない。

| 指摘 | 判断・修正 | 回帰検証 |
| --- | --- | --- |
| optional pathのmissing判定が入力検証より先 | canonical pathを先に検証し、既存identity APIと同じ診断にする | 空・traversal・metadata path拒否、missing・通常file・dangling symlinkの正常系 |
| local TaskをPR配信に使用できる | ShipとPRのci-checkでdelivery=prを要求 | Development/Learnのlocal finish成功、stage/commit後もlocal配信拒否 |
| 古いmerge-baseからbootstrapへ迂回できる | trusted checkerとbootstrap可否は現在target base、差分照合はmerge-baseで判断 | 実workflow shellを分岐fixtureで実行し、現在baseのchecker選択とbootstrapのtarget-base引数を確認 |
| lockfileがpeer variantの割当を失う | root・edge・snapshotの完全identityを保持。反対側root更新に一意に対応するpeer構成変更だけを許可 | root/親間のvariant入替、曖昧対応、異内容衝突、通常共有依存変更を拒否。Development/Learnのqualified・nested peer更新は成功 |

独立レビューで、単純な完全key固定が正常なproduct peer更新まで拒否する副作用を検出し、
上表の一意な対応による比較へ修正した。成功証拠のためにproduct/Learn境界を緩めていない。

今回のLearnは変更前source HEAD `b9924bdb0080259fc21608c7dc97c4263c250827`の一時repositoryで開始し、
開始時checkerと旧policy/profileを固定する。最初のDecisionではtree ownershipに対して
17filesだけをrepresentationへ列挙した不一致を検出したため、同じTask/baselineを保持し、
Decisionのownershipを実際の17filesへ限定するcheckpointを追記した。
未検証変更をbaselineへ取り込まず、検証・独立レビュー・ローカル確定のidentityを別添記録に保存する。
移行記録3filesはPR全体のbootstrap manifest/独立レビューで管理する。Goalは追加していない。

先のfollow-upはその後b9924bdbとしてcommit/pushされ、GitHub Actionsのverifyとzizmorが成功した。
このreview対応差分はローカル変更であり、commit/push・remote CI・GitHubコメント返信/resolveは未実施。

---
title: Adopt AIDD Invariant Protocol
doc_type: adr
status: accepted
area: repository
applies_to:
  - docs/ai-driven-development
  - docs/harness
  - tools/aidd
  - .codex
topics:
  - ai-driven-development
  - guardrails
when_to_read:
  - AIDD Coreとagent adapterの責務を変更するとき
---

# Adopt AIDD Invariant Protocol

## Status

Accepted 2026-09-05. ユーザーが採用したvNext設計に基づく。

## Context

旧AIDDは要求混入、判断の事後変更、検証漏れを工程Goalと固定executorで防いでいた。
schema v4の完成状態、ownership、rule closure、runner、snapshot、staged gateは有用だが、
工程の手順をagent/modelに固定することはそれらの保証の必要条件ではない。

## Decision

vendor-neutral Task / Decision / Checkpoint / EvidenceをCoreとする。
DevelopmentはIssue指定の実行依頼に自動適用し、Codexでは1 Goalで継続する。
探索・要求理解・設計は反復可能とし、checkpointを追記型revisionで改訂する。
baselineを保持し、decision改訂と対象変更で古い証拠を失効させる。
LearnはIssue不要の独立guardrail更新として検証・review・確定まで完了する。
Goal、Hooks、modelと委譲はadapterへ分離する。

ADR 0001の薄い入口・記録・機械的guardrailを継承する。ADR 0002のMarkdown正本と依存graphを
継承し、hard routingをpath/surfaceと実差分で決定する。探索metadataを強制条件にしない。
ruleの意味はMarkdown、適用と検証接続はrule-map/contract、実行検査はcheckerが所有する。
priorityで適用ruleを除外しない。

ADR 0002の2026-08-23 Clarificationのうち、Designでの手動additional_rules固定、
Build receipt、別Coverage recordに結び付いた実行方式を本Decisionで置き換える。
path固有ruleの和集合と依存closureという不変条件は維持し、checkpoint生成と実差分検査が自動計算する。

## Consequences

旧phase実行入口は廃止する。旧artifactは履歴として残し、新しい証拠へ昇格させない。
独立したLearnでも開始時checker、旧policy/profile、明示許可、独立reviewを必要とする。
初期版は専用worktreeの単一writer、全証拠失効、1 PR=1 taskを維持する。
意味的な正しさやreview権限はhashだけでは証明できず、agent/reviewerが責任を持つ。

## Clarification: Configuration ownership and continuation (2026-09-05)

混在設定はファイル単位の一括guardrail分類を用いず、JSON fieldとpnpm依存closureで
productと検証機構の境界を検査する。独立したVite build設定はproductとして扱う。
Task baselineの固定は検証対象差分の固定を意味し、task期間全体のHEAD等号を意味しない。
元baselineの子孫commitから同じTask/Goalで判断改訂・再検証・再Shipを行える。
初回bootstrapでも対象差分のmanifestに結合した独立review記録をCIで要求する。

## Clarification: Feedback causes and bounded routing (2026-09-05)

review feedbackの症状と再利用可能な原因は別軸であり、local defectでも対応前にguardrail failureを評価する。
purely localの場合だけ同じDevelopment / Decisionで閉じ、再利用可能な制御不全は独立Learnへ渡す。
AIDD surfaceはcontrol planeとharnessの具体的pathに限定する。一般文書・GitHub設定は
個別pathのruleと依存closureで扱い、surface範囲外であることをrule適用免除にしない。
これはguardrail immutabilityの対象を縮小する判断ではない。

## Clarification: Delivery authority and dependency identity (2026-09-05)

Taskのdelivery=localはPR配信の許可ではない。localのfinishは維持し、Shipとcommit後のPR検査はdelivery=prを要求する。
bootstrap可否とtrusted checkerの取得元は現在のtarget baseで判断し、変更対象の差分基準はmerge-baseとして分離する。
現在のbaseにv5があれば、古い分岐からcandidate自身のbootstrapへ迂回しない。
lockfileの保護対象root・依存edge・snapshotはpeer-qualified identityを保持し、variantの集合が同じでも
親・importerからの参照先が異なる状態を同一とみなさない。
同じ反対側root宣言の更新から一意に導けるpeer構成の変更は許可し、正常なproduct/tool更新の経路を維持する。
この対応で保護対象package自身のversion・通常共有依存・resolutionの変更を許可しない。

## Clarification: Learn review ownership (2026-09-08)

Learnの独立review必須条件は、不要なsubagent呼び出しとトークン消費を招くため撤廃する。
担当agent自身が最新差分と検証証拠をreviewし、ユーザーの明示依頼がある場合だけ別agentへ委譲する。
開始時checker、旧policy/profile、明示された変更許可、scopeと証拠同一性の検査は維持する。
finish/Ship/CIではLearnのreview記録を要求しない。初回bootstrapのreview契約は変更しない。


## Clarification: Incompatible checker contract migration (2026-09-11)

通常PRのbase checkerによる検証を維持し、checker契約自身の非互換変更には明示的な移行経路を設ける。
候補のテスト・ci-check、base所有の限定差分検査、対象runとcommitに結合したGitHub Environmentの
人による承認をすべて要求する。candidate成功だけを旧契約の置換権限とはしない。
元Task、baseline、開始時checkerの記録は保持し、product変更をこの経路へ混在させない。
これは通常Learnの独立review再導入ではなく、CIが使用する契約を変更する場合の承認境界である。

## Clarification: Remove Task delivery classification (2026-09-10)

2026-09-05のDelivery authority補足のうち、Taskのlocal/pr区分とそれを要求するShip・CI条件を撤去する。
配信範囲はユーザーの明示指示とconstraints・Doneで判断し、後続のShip許可を同じTaskで扱う。
新規Taskはdeliveryを保存せず、既存記録はhashを保つ読取互換fieldとして残す。
finishは最新証拠、Shipは追加でindex、CIはGit転送とbaselineを検査する。
開始時checkerの固定、明示許可、finite scope、policy/profile、証拠同一性などの安全条件は維持する。
旧binaryの固定を解除する移行は本変更に含めない。

## Clarification: Migration candidate baseline isolation (2026-09-11)

candidateのGo全テスト・check-allと統合結果の検証は現在のPR headで実行する。PR headがtarget baseを
取り込んだmerge commitの場合、元Taskのevidenceをtarget base側の既存変更と混ぜないため、candidate版
ci-checkだけはmerge commitのfirst-parent treeへ指定Taskのdirectoryだけをheadから重ねて適用する。
そこからPR本文で指定したTaskの`baseline_head`を読み取り、`--task`とともにcandidate checkerへ渡す。
base側の差分・scope検査と人の承認は、PRのmerge-baseからheadまでの全差分へ適用し、通常PRの`ci-check`は
従来どおりPR merge-baseを使う。


## Clarification: Explicit integration context and final evidence (2026-09-12)

Task開始点を履歴・権限の記録として保持し、main取り込み後の変更判定基準をcheckpointの統合記録で分離する。
Gitの包含関係とCIの現在のtarget baseへの一致を検査し、変更権限・ownership・rule・必須検証を統合baseとの
差分へ適用する。証拠は統合後の全inventoryに結合し、旧証拠は全失効させる。権限範囲は拡張しない。
2026-09-11のMigration candidate baseline isolationにある過去treeへの投影を置き換え、candidate ci-checkも
最終headを検査する。開始時checkerの固定は維持し、旧Taskの実行binary移行を暗黙に許可しない。


## Clarification: Explicit Learn checker succession (2026-09-12)

旧checkerで進められないLearnは、元Taskを保持したまま明示的なchecker移行をcheckpointへ追記できる。
移行元のcheckpoint・証跡・checkerと移行先checker、実際の許可、追加の有限guardrail scopeを記録する。
Taskの開始記録・旧policy/profileは保持し、新しい全体証跡は移行先binaryに結合する。
通常CIはこのTaskを受け入れず、候補の移行検証・base側差分検査・人の承認をすべて要求する。
記録なしのbinary差し替え、旧証跡の成功流用、Taskの再作成は認めない。


## Clarification: Repository policy and technology adapters (2026-09-12)

CoreはTask・checkpoint・証拠・変更範囲の整合を所有し、repository固有の必須検証、
禁止tree scope、runner起動方針は開始時に固定するrepository policyが所有する。
Storybook source、pnpm依存構造、Vitest/Python結果の技術的な解釈はアダプタへ分離し、
検証の必須化や変更許可はpolicyとCoreが担う。既存の不変条件を保持し、判定方式自体を固定しない。
Taskの保存形式を変えず、repository policyは開始時Git treeとbaseline inventoryのhashに結合する。
policy導入前の記録は隔離した旧方針で読み取り、新規実行の設定欠落は拒否する。
これは汎用ルールエンジンの導入や、既存Taskのchecker固定・許可境界を緩和する決定ではない。

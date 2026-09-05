---
title: AIDD Checker Architecture
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

# AIDD invariant / integrity checker

Coreは`tools/aidd/checker/internal/protocol`。schema v5のTask、Decision、checkpoint、evidenceを
検査し、phase順序、Goal lifecycle、model、executor、agentのStop判断を制御しない。
Codex Hookは`internal/adapters/codex/hooks`に置き、Coreから参照しない。

## 保存する保証

既存のsemantic target検証、catalog、rules、repository snapshot、state、runner、evidenceを共有する。
要求→behavior→verification→representationの参照、finite ownership、最終inventory、path/surface
closure、profile-fixed argv、test selectorの実行identity、stream/output hashを検証する。
manual観察の形式検査を意味的正しさの証明とは扱わない。

Task開始時の全non-ignored file inventory、Git HEAD、policy、rule-map、profile bytes、
checker executable hashを固定する。開始にはcleanな専用worktreeを要求する。
Taskとcheckpointはmode 0600のcanonical JSONとしてatomic writeし、既存recordを上書きしない。
raw policy/profile bytesはbase64で保持し、serializationによるhash変化を防ぐ。

checkpointはTask hashと親checkpoint hashを持つ追記型revision。baselineを持ち直さない。
最新checkpoint以外の証拠、対象content/mode/inventoryが異なる証拠を拒否する。
検証時はtask外を含むrepository stateに証拠を結び付ける。

runnerは専用process groupを使い、残留processを終了・拒否した後にGit管理対象と
未ignoreの新規fileのmutation manifest、HEAD、staged treeを比較する。GIT_*の注入を除去する。
Git管理対象はignore指定があっても検査し、未追跡fileの選択にはGitの標準ignore設定を使う。
ignore対象の未追跡生成物・cacheは原則除外し、生成物ごとの例外リストは設けない。
rootと親directoryの更新時刻を比較しないため、正常な生成物の作成・削除でも拒否しない。
既存の対象fileのcontent/mode/identity、HEADとindexの検査は維持する。
対象fileの追加・削除は検証前後のinventoryで検出する。snapshot間に作成して削除された
未追跡fileや空directoryの一時変更は保証範囲に含めない。
明示された所有成果物のhash検査は別に維持し、ignoreを成果物検証の免除には使わない。
canonical JSON、snapshot bytes、path traversal/symlink拒否、出力mode検査を継承する。

Shipは検証済みworktree全体とindexのcontent/Git modeが一致し、未stage出力がないことを要求する。
CIはclean candidateのGit転送を検証し、baseのcheckerでTask baselineを実際のGit treeへ照合する。
Gitは0600などのローカル権限を保存しないため、CIではblob contentとGit modeを比較する。
ローカル検査の0600要件は緩和しない。

## Learnの信頼境界

Learnも開始時binaryを使う。candidate checkerへの置換をhashで拒否し、旧profileと旧policyを
Taskのbytesから解決する。product pathsと許可scopeは旧policyで検査する。
混在package設定とlockfileはworkflowのfield/依存closure境界に従い、tool更新の同期を許可する。
新checkerのtest成功だけではLearnを確定せず、独立reviewと明示許可を最新evidenceへ固定する。
reviewの意味・確認者・権限は人間または独立review担当が責任を持つ。JSONやhashは署名ではない。

## 運用前提と限界

専用worktree・単一writer、信頼された開始時checker/Git/OS、明示的に許可された操作を前提とする。
同一worktreeへの外部並行writer、直接の.git改変、binary置換を攻撃的に隠すOS操作は防御対象外。
checkerが自己申告された意味を証明したり、暗号署名なしで証拠作成者を認証したりはしない。
agentは解釈、戦略、設計、reviewを担い、checkerは決定論的な整合を検査する。

初期版はclean start、1 PR=1 task、全失効、逐次verificationを採用する。
1 Task内の複数commit・PR review後の再開は対応し、元baselineを維持して全差分を再検証する。
共有worktreeへの並行writer、部分証拠再利用、複数taskのPR合成は未対応。
これは既存保証の維持を優先した境界であり、黙って成功扱いへ緩和しない。

## 実装責務

- protocol: v5 task / decision / checkpoint / verification / delivery。
- semantic / state / rules: targetとownership、rule graph、最終状態。
- repository: Git、filesystem、snapshot、atomic output、mutation manifest。
- verificationcontract / runner / evidence: agent非依存の実行入力と証拠。
- adapters/codex: Codex lifecycle支援。正本状態・公開許可を所有しない。
- gates / handoff / receipt / render: historical v4保証の読取・回帰用。新規実行の公開入口はない。

AIDD制御ロジックはGoで実装する。新しい言語の互換実装を追加しない。

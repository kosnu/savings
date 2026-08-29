---
title: AIDD Checker Architecture
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd/checker
  - docs/ai-driven-development/contracts
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - validation
  - verification
  - trust-boundary
when_to_read:
  - AIDD checker、artifact schema、verification profileを変更するとき
  - Design completionまたはBuild evidenceの信頼境界を判断するとき
---

# AIDD Checker Architecture

`aidd-checker` は schema v4 の Requirements、Design、Design completion、Build
verification、Build coverage を単一 Go binary / 単一親processで検証する。新規 cycle
の write / promotion path はこの checker だけである。schema v2 / v3 は read-only
compatibility input とし、新規 Goal、receipt、Build evidenceへ昇格しない。

checker実装はAIDDワークフロー所有のrepo-local CLIとして`tools/aidd/checker`に置く。
各skillとphase agentはcheckerを所有せず、
[AIDD Checker Operations](./aidd-checker-operations.md)に従って呼び出す。

## Operating Contract and Threat Boundary

AIDDの1実行は専用Git worktreeを1つだけ使用し、そのworktreeを1つのCodex sessionと
1つのagentが排他的に所有する。所有agentはchecker、verification command、Git commandを
同一sessionから順次実行し、checker実行中に別session、別agent、ユーザー操作、常駐processが
同じworktree、Git index、`HEAD`を変更しない。

Requirements、Design、Build / Verifyはworktreeの成果物だけを変更する。Build Entryから
Build / Verify完了までは`HEAD`、current branch、Git indexが表すstaged treeを変更しない。
`git add`、`git commit`、`git commit --amend`、`git merge`、`git rebase`、`git reset`、`git switch`、
`git checkout`はShipだけが所有する。Git indexのraw bytes、stat cache、visibility flagは
AIDD成果物のidentityとして扱わない。

Ship対象はBuild / Verifyで検証したworktreeのfile contentとGit modeである。Shipはその
検証済み状態だけをstageし、stage後のindexが表すcontentまたはmodeが検証済みworktreeと
異なる場合、あるいは検証後にworktreeが変わった場合はcommitせずBuild / Verifyへ戻る。

Git判定の意味はcanonical worktree、repo-owned contract、checkerが明示する引数だけが
決定し、ユーザーまたはsystemのGit configに依存させない。sparse checkout、submodule、
alternate index、`assume-unchanged`、`skip-worktree`は通常のAIDD worktreeに持ち込まない
運用前提とし、checkerはこれらの契約外状態を個別に検出しない。

Git状態についてcheckerが検証するのは、Build EntryとBuild / Verify完了で契約上の
`HEAD`とstaged treeが不変であること、checkerが起動したverification commandが宣言外の
repository変更を残していないこと、Ship候補が検証済みworktreeと一致することに限定する。

checkerが正常系として扱うrepository変更は、所有agentが明示的に起動したcheckerまたは
verification commandによる変更だけである。checkerは各commandの開始時に現在のrepository
状態を読み、checker自身が起動したcommandの終了後にそのcommandが契約外の変更を残して
いないことを検証する。verification commandの子processはそのcommandの一部として扱い、
command完了時に残留していれば失敗とする。

別session、別agent、ユーザー操作、常駐processによる並行変更、`.git`内部の直接改変、
checkerまたはGit実行ファイルの差し替え、OSまたはfilesystemの破損は運用契約違反であり、
checkerの防御対象に含めない。これらの契約外事象を仮定したlock、critical section、反復確認を
追加せず、通常の単一所有経路で検査対象と後続phaseへ渡す対象が一致するために必要な検証だけを
実装する。

## Boundaries

- `internal/model` と `internal/semantic`: typed domain model と pure semantic rules。
- `internal/pathcontract`: filesystemへ触れないrepository-relative pathとworkspace名の字句契約。
- `internal/canonical`: duplicate keyを拒否するstrict JSON、canonical serialization、hash。
- `internal/catalog`: repo-owned verification profile catalog と profile hash。
- `internal/requirementscontract`: Requirements section ID、順序、exact heading aliasの共有正本。
- `internal/rules`: canonical `docs/harness/rule-map.json` のpath契約と読取、closure、path / surface routing。
- `internal/repository`: Go `os.Root`で閉じたcanonical Git root、親processの全`GIT_*`を除去したGit実行境界、正本worktreeのindex path、single-read snapshot、snapshotへ固定したGit `HEAD`とHEAD blob identity、通常inputの全path segment symlink拒否、untracked symlink targetの非追跡identity、型・権限・内容drift、ignore非依存repository mutation manifest、verification command前後のstaged tree identity、atomic output。
- `internal/handoff` / `internal/receipt`: source / displayのcontent hashとpermission modeを固定するDesign completion capture と、全Build entrypointで同じidentityを再検証するBuild Entry。
- `internal/runner` / `internal/evidence`: 親processの全`GIT_*`を除去したprofile-fixed execution と structured evidence。
- `internal/state` / `internal/coverage`: owned final state と actual diff の照合。
- `internal/phasecontract`: phase ownership contract と agent representation の照合。
- `cmd/aidd-checker`: CLI adapter。domain ruleを持たない。

checker はpathとworkspace名の字句検証を`internal/pathcontract`へ集約し、repository内の
file、directory、ownership tree、selector、runner working directoryの実在性とsymlinkを
`internal/repository`だけから解決する。path traversal、`.git`・`.hg`・`.svn` metadata segment、symlink、非regular fileをfail
closedで拒否する。inputはsnapshot cacheから読み、同じpathを意味判定ごとに
再読込しない。artifact gateはcanonical workspace sourceだけをsnapshotから読み、
repository外の一時sourceはGoal kindだけに許可する。verification case実行後にcached inputの
内容、型、権限driftを検査する。Design completionは固定したGit `HEAD`からbaseline blobを読み、
CLIが宣言したcanonical outputだけをatomic writeする。checkerが起動した親processの`GIT_INDEX_FILE`、
`GIT_DIR`、`GIT_WORK_TREE`、config injectionを含む全`GIT_*`はGit subprocessへ継承せず、
canonical rootから解決したworktree indexだけを通常Git検証へ明示する。Git、filesystem、
process実行はpure semantic packageへ入れない。

Requirements section contractは
`docs/ai-driven-development/contracts/requirements-sections.json`が所有し、current
artifact、retained Goal、Git `HEAD` baselineのすべてが同じID順序とnormalized exact
heading aliasを使う。managed Requirementsは最低1件のRequirementを持つ。Requirements
Input GateはIssue本文内に実在する各declared evidence spanについてrule-map全nodeを再評価し、
同じ`match.field/value`条件を満たすdirect node集合と宣言集合の完全一致を要求する。

Design rule coverageはRequirementsとimplementation surfaceから得た自動rule closureを
`additional_rules`へ再掲することを拒否し、手動追加ruleをcanonical rule-map順に固定する。

## Verification Profile Trust Boundary

Design sourceは実行commandを持たず、automated caseごとに
`verification_profile_id` と typed `selector` を持つ。固定argv、working directory、
runner adapter、allowed selector kindはAIDDワークフローの共有契約
`docs/ai-driven-development/contracts/verification-profiles.json` が所有する。

Design completion receiptはcatalog全体と選択profileをhash固定する。Buildでは次を
拒否する。

- catalogまたは選択profileのdrift
- `git-diff-check`が固定済み`HEAD`からfinal worktreeまでを対象にしないargv
- 親processの`GIT_*`でverification profileのrepositoryまたはindexを差し替える実行
- profile contractと異なるselector kind
- caseの欠落、余剰、重複、順序ずれ
- selectorと一致しないruntime test path / full name、または単一`passed`以外のreport
- 旧command allowlist形式のsourceまたはevidence
- direct runner終了後に残ったverification process。専用process groupを終了して残留がないことを確認してからcase後stateを検査する
- case後に変化したtask-owned final state
- case後に変化したignore対象を含むrepository pathのtype・permission mode・size・mtime・ctime・device・inode、Git `HEAD`のcommit・symbolic reference、またはGit indexが表すstaged tree

Requirements / Designのcanonical sourceとdisplayはcontent hashだけでなくpermission modeも
receiptへ固定し、`receipt.Load`を使う全Build entrypointで再検証する。receipt自身は
atomic writerのcanonical mode `0600`を要求する。どちらもmode-only変更をread-only上流
artifactのdriftとして、coverage対象から除外する前に拒否する。

Vitest JSONとPython unittestの標準runner結果はGo adapterがtyped runtime identityへ
変換する。checker所有のPython sourceやadapter scriptは置かない。suite profileと
test-case profileは区別し、suite成功を単一test-case成功へ読み替えない。evidenceは
profile ID / hash、selector、executed identities、exit / stream境界、framed output
hash、final-state hashを保持し、保存bytesがtyped valueのcanonical JSONと完全一致する
場合だけcoverage identityへ使用する。

manual verificationはDesign procedureとBuild observationへ同じ実質性契約を適用する。
空白、記号、symbol、control / combining markを除いたUnicode文字を8文字以上要求し、
observationはさらに単一行だけを受理する。captureとevidence再検証は同じ共有実装を
使い、短文化または複数行へ編集されたmanual evidenceを拒否する。保存evidenceの
case type別field集合は排他的であり、manual result内のautomated専用keyとautomated
result内のprocedure / observationは、empty、`null`、空配列を含めて拒否する。

## Version and Retirement Policy

- v4: active schema。Go checkerの全gateを利用できる。
- v3 / v2: historical read-only schema。Goのenvelope検査とhistorical corpus回帰だけに
  利用できる。
- AIDD checker、phase contract validator、profile adapter、その回帰testはGoだけで
  実装する。旧Python validatorをfallbackまたは互換実装として保持しない。

## Performance Acceptance

移行時は同じrepository artifact corpusに対して旧Python checkとGo `check-all`を
実行し、wall time、peak RSS、起動subprocess数を記録する。移行後の性能回帰はGo
checkerだけを同じcorpusで計測する。OS制約でpeak RSSを取得できない場合は未計測と
明記し、推定値で補わない。

### 2026-08-29 Full Corpus Acceptance

移行直前commit `66e03bc0c9ad68899af8e7d594a79e5acfbc846d`を新しいGit repositoryへ展開し、
同じhistorical v2 source 2件だけを持つcanonical artifact corpusに対して旧Pythonと
現在Goのrepository-wide `check-all`を各5回実行した。表はwall timeとmaximum resident
set sizeの中央値である。

| Path | Wall time | Peak RSS | Direct subprocess starts |
| --- | ---: | ---: | ---: |
| Python `render_aidd_artifact.py --check-all` | 0.19 s | 24,444,928 bytes | 11 |
| Go `aidd-checker check-all` | 0.07 s | 8,617,984 bytes | 8 |

wall timeとpeak RSSはmacOS `/usr/bin/time -lp`で取得した。subprocess数は`PATH`先頭の
計測用`git` wrapperから`/usr/bin/git`へ全argvをそのまま転送し、実際の起動件数を記録した。
Go binaryのbuild時間は含めない。これは両実装が所有するpublic full-corpus checkの性能
受入であり、semantic parityの証明には使わない。削除したPython意味契約との同等性は
Go回帰testが所有する。この値は旧実装削除後の性能回帰baselineとして保持する。

### 2026-08-28 Repository Mutation Manifest Baseline

38,056件のignored pathと1.0 GiBの`node_modules`を含む実worktreeで、`.git` metadataを
除く44,559 entryを走査した。`BenchmarkMutationManifest`を5回実行した結果は平均
0.517 s/op、58,765,472 alloc bytes/op、478,746 allocs/opだった。regular fileの内容は
読まずmetadataだけを取得するため、2回の前後比較は約1.03秒である。macOS sandboxが
`sysctl kern.clockrate`を拒否したため、この計測のpeak RSSは未取得であり、allocation
bytesをpeak RSSとして扱わない。

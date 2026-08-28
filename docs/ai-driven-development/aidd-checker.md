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

## Boundaries

- `internal/model` と `internal/semantic`: typed domain model と pure semantic rules。
- `internal/canonical`: duplicate keyを拒否するstrict JSON、canonical serialization、hash。
- `internal/catalog`: repo-owned verification profile catalog と profile hash。
- `internal/requirementscontract`: Requirements section ID、順序、exact heading aliasの共有正本。
- `internal/rules`: rule-map の読取、closure、path / surface routing。
- `internal/repository`: Go `os.Root`で閉じたcanonical Git root、single-read snapshot、通常inputの全path segment symlink拒否、untracked symlink targetの非追跡identity、型・権限・内容drift、ignore非依存repository mutation manifest、raw Git index identity、atomic output。
- `internal/handoff` / `internal/receipt`: Design completion capture と Build Entry。
- `internal/runner` / `internal/evidence`: profile-fixed execution と structured evidence。
- `internal/state` / `internal/coverage`: owned final state と actual diff の照合。
- `internal/phasecontract`: phase ownership contract と agent representation の照合。
- `cmd/aidd-checker`: CLI adapter。domain ruleを持たない。

checker は repository内のfile、directory、ownership tree、selector、runner working
directoryを`internal/repository`だけから解決し、path traversal、symlink、非regular
fileをfail closedで拒否する。inputはsnapshot cacheから読み、同じpathを意味判定ごとに
再読込しない。出力直前とverification case実行後にcached inputの内容、型、権限driftを
検査し、CLIが宣言したcanonical outputだけをatomic writeする。Git、filesystem、
process実行はpure semantic packageへ入れない。

Requirements section contractは
`docs/ai-driven-development/contracts/requirements-sections.json`が所有し、current
artifact、retained Goal、Git `HEAD` baselineのすべてが同じID順序とnormalized exact
heading aliasを使う。managed Requirementsは最低1件のRequirementを持つ。

## Verification Profile Trust Boundary

Design sourceは実行commandを持たず、automated caseごとに
`verification_profile_id` と typed `selector` を持つ。固定argv、working directory、
runner adapter、allowed selector kindはAIDDワークフローの共有契約
`docs/ai-driven-development/contracts/verification-profiles.json` が所有する。

Design completion receiptはcatalog全体と選択profileをhash固定する。Buildでは次を
拒否する。

- catalogまたは選択profileのdrift
- profile contractと異なるselector kind
- caseの欠落、余剰、重複、順序ずれ
- selectorと一致しないruntime test path / full name、または単一`passed`以外のreport
- 旧command allowlist形式のsourceまたはevidence
- direct runner終了後に残ったverification process。専用process groupを終了して残留がないことを確認してからcase後stateを検査する
- case後に変化したtask-owned final state
- case後に変化したignore対象を含むrepository pathのtype・permission mode・size・mtime・ctime・device・inode、Git `HEAD`のcommit・symbolic reference、またはraw Git index bytes全体

Vitest JSONとPython unittestの標準runner結果はGo adapterがtyped runtime identityへ
変換する。checker所有のPython sourceやadapter scriptは置かない。suite profileと
test-case profileは区別し、suite成功を単一test-case成功へ読み替えない。evidenceは
profile ID / hash、selector、executed identities、exit / stream境界、framed output
hash、final-state hashを保持する。

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

### 2026-08-28 Compatibility Corpus Baseline

同じGit `HEAD`上のhistorical v2 source 2件を対象に1回ずつ計測した初期値は次の
とおり。Pythonはlegacy render / display check、Goはv2 / v3 read-only compatibility
scanであり、これは移行時の起動cost比較であってsemantic parityの証明ではない。

| Path | Wall time | Peak RSS | Direct subprocess starts |
| --- | ---: | ---: | ---: |
| Python `render_aidd_artifact.py --check-all` | 0.30 s | 30,294,016 bytes | 5 |
| Go `aidd-checker check-all` | 0.01 s | 7,045,120 bytes | 1 |

wall timeとpeak RSSはmacOS `/usr/bin/time -lp`で取得した。subprocess数は実行pathの
`run_git` / `exec.CommandContext`呼出しから算出した。DTraceによるruntime exec countは
hostのSystem Integrity Protectionにより取得できなかった。この値は旧実装削除後の
回帰比較用baselineとして保持する。

### 2026-08-28 Repository Mutation Manifest Baseline

38,056件のignored pathと1.0 GiBの`node_modules`を含む実worktreeで、`.git` metadataを
除く44,559 entryを走査した。`BenchmarkMutationManifest`を5回実行した結果は平均
0.517 s/op、58,765,472 alloc bytes/op、478,746 allocs/opだった。regular fileの内容は
読まずmetadataだけを取得するため、2回の前後比較は約1.03秒である。macOS sandboxが
`sysctl kern.clockrate`を拒否したため、この計測のpeak RSSは未取得であり、allocation
bytesをpeak RSSとして扱わない。

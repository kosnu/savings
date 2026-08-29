---
title: AIDD Checker Operations
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd/checker
  - docs/ai-driven-development/contracts/verification-profiles.json
  - docs/ai-driven-development/contracts/requirements-sections.json
  - docs/ai-driven-development/workspaces
  - .github/workflows/aidd_checker_ci.yaml
topics:
  - ai-driven-development
  - validation
  - verification
  - schema-v4
when_to_read:
  - Requirements、Design、Build、ShipのAIDD gateを実行するとき
  - AIDD checkerのCLI引数と実行順序を確認するとき
---

# AIDD Checker Operations

Requirements、Design、Build、Ship の現行 gate は Go 製 `aidd-checker` を使う。新規
managed source、receipt、Build evidence は schema v4 である。schema v2 / v3 は
履歴の読取互換入力であり、render、Goal 完了、receipt 作成、Build 入力へ昇格しない。

## Toolchain, Build, and Trust Boundary

Go 1.27.x はAIDD実行の必須toolchainである。repository rootでversionを確認し、Goが
見つからない場合または`go env GOVERSION`が`go1.27`系列でない場合は停止する。
AIDD cycleまたは単独phase Goalの入口では、既存の`/tmp/aidd-checker`を信頼せず、
現在checkoutのsourceから一時pathへbuildしてatomic renameする。build、rename、version
確認のいずれかが失敗した場合は、残っている旧binaryを使わず停止する。以後のgateと
verificationは、その入口でbuildした同じbinaryを使う。

```sh
go env GOVERSION
go build -C tools/aidd/checker -o /tmp/aidd-checker.next ./cmd/aidd-checker
mv /tmp/aidd-checker.next /tmp/aidd-checker
/tmp/aidd-checker version
```

checker は domain / semantic validation を pure core に置き、Git、filesystem、CLI、
verification runner を adapter として分離する。repository input は canonical Git
root から regular non-symlink file として一度だけ読み、最終 drift check まで同じ
snapshot bytes を使う。repository 内へ書けるのは、呼び出した command が宣言する
Markdown、receipt、Build evidence、Build coverage だけである。失敗は `code`、
`path`、`artifact`、`expected`、`actual`、`message` を持つ JSON diagnostic と nonzero
exit で返す。

rule mapは`docs/harness/rule-map.json`だけを正本として受理する。`--rule-map`を明示する
場合もこのpath以外は拒否し、RequirementsまたはDesignの入力へ代替rule mapを使用しない。

phase ownership contractも同じbinaryで検証する。

```sh
/tmp/aidd-checker validate-phase-contract --repo-root <repo-root>
```

このgateはcanonical contract、phase assignment、Goal ownership、agent registration、
agent instructionsを照合する。AIDD cycleとGoal settingは委譲またはGoal作成前に実行する。

## Workspace

```sh
/tmp/aidd-checker workspace \
  --repo-root <repo-root> \
  --issue <owner/repo#number> \
  --issue-title <current-issue-title>
```

既存 workspace が1件なら再利用し、複数なら停止する。0件なら完全な Issue title
から一意に導出した名前だけを使う。

## Requirements

Issue body と Goal JSON は repository 外の一時 regular file に保存する。

```sh
/tmp/aidd-checker validate-requirements \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-title <cycle-start-title> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --document <requirements-goal-json> --kind requirements_goal

/tmp/aidd-checker render \
  --repo-root <repo-root> \
  --source docs/ai-driven-development/workspaces/<workspace>/requirements.json \
  --output docs/ai-driven-development/workspaces/<workspace>/requirements.md \
  --kind requirements

/tmp/aidd-checker validate-requirements \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-title <cycle-start-title> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --document docs/ai-driven-development/workspaces/<workspace>/requirements.json \
  --kind requirements \
  --goal-document <requirements-goal-json>
```

gate は Issue snapshot identity、正規化後もmatch値を含むdirect rule evidence、完全な dependency
closure、Requirement inventory / transition、Git `HEAD` baseline、Goal と artifact
の gate identity を検証する。各declared evidence spanはIssue本文内の存在確認後にrule-map全nodeへ
照合し、同じ`match.field/value`へmatchするdirect nodeを一部だけ宣言した入力を拒否する。section ID、順序、heading aliasの正本は
`docs/ai-driven-development/contracts/requirements-sections.json`であり、artifact、
retained Goal、Git `HEAD` baselineのすべてへ同じ規則を適用する。Requirementが0件の
managed sourceは完成状態として受理しない。changed / newのIssue evidenceは正規化後も
Issue本文と一致し、Requirementまたはsectionの所有content内だけに存在する一意の根拠を
要求する。section content identityはheading、block、owned Requirement ID / textを含む。
retired evidenceは対象Requirement IDだけと肯定的な廃止意思を同じIssue文内に要求し、
別Requirement IDの併記や廃止を否定する文を拒否する。完了直前に Issue snapshot を
再取得して再検証する。
`requirements_goal`だけがrepository外の一時sourceを受け取り、`requirements`は
`--document`がcanonical workspace pathを指す場合に限ってrepository snapshotから読む。

## Design and Verification Profiles

```sh
/tmp/aidd-checker validate-design \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --requirements docs/ai-driven-development/workspaces/<workspace>/requirements.json \
  --document <design-goal-json> --kind design_goal

/tmp/aidd-checker render \
  --repo-root <repo-root> \
  --source docs/ai-driven-development/workspaces/<workspace>/design-doc.json \
  --output docs/ai-driven-development/workspaces/<workspace>/design-doc.md \
  --kind design

/tmp/aidd-checker validate-design \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --requirements docs/ai-driven-development/workspaces/<workspace>/requirements.json \
  --document docs/ai-driven-development/workspaces/<workspace>/design-doc.json \
  --kind design \
  --goal-document <design-goal-json>
```

schema v4 `validation.target_state` は完成状態の唯一の正本である。automated
`verification_cases` は `verification_profile_id` と typed `selector` だけを持ち、
`command` を持たない。selector は profile 固定 suite 全体を表す
`{"kind":"suite"}`、または単一 test を表す
`{"kind":"test_case","path":"<repo-relative>","name":"<exact name>"}` である。
manual case は concrete `procedure` だけを持つ。procedureは空白、記号、symbol、
control / combining markを除いたUnicode文字を8文字以上持つ場合だけ実質的とみなす。
cycle-start Issue titleは渡さず、検証済みcanonical Requirementsからだけ導出する。
Requirementsは常にcanonical workspace pathからsnapshot経由で読み、`design_goal`だけが
repository外の一時Design sourceを受け取る。`design`はcanonical workspace source以外を拒否する。

repo-owned catalog は
`docs/ai-driven-development/contracts/verification-profiles.json` であり、各 profile が fixed argv、
working directory、runner adapter、allowed selector kind を所有する。Design receipt
は catalog 全体と選択 profile の SHA-256 を固定する。Build 中の catalog 変更、未知
profile、selector contract 不一致は失敗し、profile 変更が必要なら Design へ戻る。

Vitest adapter は正規表現metacharacterをescapeした完全一致name filterとJSON reporter
の test path / full name / status を使い、report全体がselectorと一致する単一の
`passed` assertionだけを持つ場合に受理する。余分なassertion、skip、失敗、未知statusは
拒否する。Go製Python unittest adapterは標準runnerが報告した完全なtest identityを
typed path / nameへ変換して完全一致で検証する。Python adapterはexact targetの単一
`ok`、`Ran 1 test`、最終`OK`だけを受理し、余分な出力、skip、FAIL、ERROR、複数結果を
拒否する。substring、test名だけ、実行commandの自己申告は証拠にしない。suite
profileとtest-case profileは別IDとし、suite実行を単一caseの証拠として流用しない。

## Design Completion and Build Entry

```sh
/tmp/aidd-checker capture-design \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-url <canonical-url> \
  --issue-updated-at <updatedAt> --issue-body <issue-body-file> \
  --goal-document <design-goal-json>

/tmp/aidd-checker build-entry \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-url <canonical-url> \
  --issue-updated-at <updatedAt> --issue-body <issue-body-file> \
  --expected-receipt-sha256 <design-completion-sha256>
```

receipt は Issue、Goal、Requirements / Design source と display、rule map と selected
rules、target state、ownership scopes、task-owned baseline inventory、非ignore untracked
pathのtype・permission mode・contentまたはsymlink target identity、Requirements / Design
source / displayのcontent hashとpermission mode、Git `HEAD`、profile catalog
と selected profile hash を同じ snapshot から固定する。Git `HEAD`はsnapshot開始時に固定し、
Git `HEAD` baseline blobはそのcommitから読み、receipt書込み直前のdriftを拒否する。
全Git subprocessは親processの`GIT_INDEX_FILE`、`GIT_DIR`、`GIT_WORK_TREE`、config injectionを
含む全`GIT_*`を除去し、system / global Git configも無効化する。snapshot開始時にcanonical
rootからworktree index pathを固定し、通常Git検証にはそのpathを明示する。
Build Entry、`capture-verification`、`validate-build`はGit `HEAD`がreceiptのBuild baselineと
一致し、baseline対staged treeに差分がないことを検証する。Build / Verifyはstageせず、
checkerが起動したverification commandの前後ではindexのstat cacheやvisibility flagではなく、
stage entryのmode・blob ID・pathが表すstaged treeの不変を検証する。canonical outputの
書込み直前にも同じBuild Git stateを再検証してatomic writeする。外部writerとの並行実行を
仮定した`index.lock`やcritical sectionは持たない。receipt自身はcanonical output mode
`0600`を要求する。Build Goal作成前とBuild完了直前に同じreceipt hashでBuild Entryを実行する。

## Build Verification and Coverage

```sh
/tmp/aidd-checker capture-verification \
  --repo-root <repo-root> --workspace <workspace> \
  --expected-receipt-sha256 <design-completion-sha256> \
  --manual-observation VC-ID=text

/tmp/aidd-checker validate-build \
  --repo-root <repo-root> --workspace <workspace> \
  --expected-receipt-sha256 <design-completion-sha256>
```

manual observationはprocedureと同じ8文字以上の実質性契約に加えて単一行を要求する。
この契約はcapture時と保存済みevidenceの再検証時に同じGo実装から適用する。

runner は親processの全`GIT_*`を除去してからcatalogの fixed argv だけを直接実行し、artifact の command や locator
metadata から実行方法を組み立てない。test-case adapter は実行 path / name が selector
と完全一致し、passed identity がちょうど1件の場合だけ成功する。各 result は profile
ID / hash、typed selector、executed identities、exit code、stdout / stderr byte length、
`AIDD-output-v1` framing hash、同一 final-state hash を保持する。
`git-diff-check`は`git diff --no-ext-diff HEAD --check --`の固定argvだけを受理し、receiptが固定した
`HEAD`からfinal worktreeまでのtracked contentを検査する。

case の欠落、余剰、重複、順序ずれ、profile drift、旧 command evidence、失敗 status、
不一致 runtime identity、canonical JSONと一致しない保存evidence bytesを拒否する。
canonical `build-verification.json`と`build-rule-coverage.json`は生成時と再検証時にmode
`0600`を要求し、Build完了後のmode-only変更をShip前に拒否する。
final-state manifest は task-owned regular file の
path、worktree 上の Git 投影 mode・content と target-state hash を固定する。これとは
別に、`.git` metadata以外のrepository全体をGit ignoreに関係なく走査し、directory、
regular file、symlinkのtype・permission mode・size・mtime・ctime・device・inodeを
各automated case前後で比較する。automated caseは専用process groupで実行し、direct
runner終了後に残留processがあれば終了させてcaseを失敗にした後、stateを比較する。
Git `HEAD`のcommitとstaged treeも比較し、ignored cache、作成後削除した一時file、ownership外の
stage変更を成功証拠から除外する。current branchはShipだけが変更できるphase contractであり、
checkerの成果物identityには含めない。
coverage はShip前までGit `HEAD`がreceipt baselineと完全一致し、staged treeに差分がないことを
要求する。実差分は`core.fileMode=true`かつ`--no-ext-diff`でbaselineからworktreeへ直接取得する。
Design時点から不変のuntracked pathは除外し、新規・変更・削除・tracked化だけをownership
scope、surface、path rule、dependency closureへ再照合する。Build完了時は`validate-build`が
canonical coverage bytesのSHA-256を出力し、completion evidenceへ記録する。
Requirements / Designのsource / displayはcoverage除外前にreceipt固定content hashと
permission modeを再検証し、receipt自身もcanonical mode `0600`を再検証する。executable
bitだけの変更も上流artifact driftとして拒否する。

## Ship Candidate Validation

ShipはBuild completion evidenceに記録したreceipt SHA-256とcoverage SHA-256を使う。
検証済みworktreeのcontentとGit modeだけをstageした後、commit前に次を実行する。

```sh
/tmp/aidd-checker validate-ship \
  --repo-root <repo-root> --workspace <workspace> \
  --expected-receipt-sha256 <design-completion-sha256> \
  --expected-coverage-sha256 <build-coverage-sha256>
```

gateはcoverage bytesとcompletion evidenceのhash一致、receipt固定入力、verification evidence、
target / final stateを再検証する。そのうえで、stage後のindexとworktreeにcontent / mode差分が
ないこと、全Build coverage pathが同じstatusでstageされていること、coverage外のstage pathが
canonical AIDD output以外にないこと、新規・変更済みnon-ignore pathがunstagedで残っていないことを
要求する。失敗時はcommitせずBuild / Verifyへ戻る。

## Compatibility and Go-only Ownership

- Go checker が schema v4 の唯一の write / promotion path である。
- Go `validate-source` / `check-all` は schema v2 / v3 の envelope を read-only として
  受理するが、v4 へ変換・render・receipt 化しない。
- historical schema v2 / v3互換性はGoのfixture / corpus testだけで固定する。旧Python
  validator、renderer、adapter、testは保持しない。
- phase contract validationとprofile adapterを含むAIDD checker所有実装はGoだけに置く。
- Python unittest profileは外部のPython testを実行できるが、repo-owned adapter自体は
  Go実装であり、AIDD checkerのbuild、test、gateにPython sourceを必要としない。

repository 全体は次で検査する。

`check-all`は各workspace直下の全JSONをstrict parseする。`requirements`または`design`
kindのsourceは、envelopeのworkspaceとkindから決まるcanonical filename/pathにある場合だけ
受理し、別名copyや別workspaceへの配置を拒否する。

```sh
/tmp/aidd-checker check-all --repo-root <repo-root>
/tmp/aidd-checker validate-phase-contract --repo-root <repo-root>
```

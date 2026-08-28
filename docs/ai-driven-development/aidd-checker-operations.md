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
  - Requirements、Design、BuildのAIDD gateを実行するとき
  - AIDD checkerのCLI引数と実行順序を確認するとき
---

# AIDD Checker Operations

Requirements、Design、Build の現行 gate は Go 製 `aidd-checker` を使う。新規
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
  --document <requirements-json> --kind requirements \
  --goal-document <requirements-goal-json>
```

gate は Issue snapshot identity、literal direct rule evidence、完全な dependency
closure、Requirement inventory / transition、Git `HEAD` baseline、Goal と artifact
の gate identity を検証する。section ID、順序、heading aliasの正本は
`docs/ai-driven-development/contracts/requirements-sections.json`であり、artifact、
retained Goal、Git `HEAD` baselineのすべてへ同じ規則を適用する。Requirementが0件の
managed sourceは完成状態として受理しない。完了直前に Issue snapshot を再取得して
再検証する。

## Design and Verification Profiles

```sh
/tmp/aidd-checker validate-design \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-title <cycle-start-title> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --requirements <canonical-requirements-json> \
  --document <design-goal-json> --kind design_goal

/tmp/aidd-checker render \
  --repo-root <repo-root> \
  --source docs/ai-driven-development/workspaces/<workspace>/design-doc.json \
  --output docs/ai-driven-development/workspaces/<workspace>/design-doc.md \
  --kind design

/tmp/aidd-checker validate-design \
  --repo-root <repo-root> --workspace <workspace> \
  --issue <owner/repo#number> --issue-title <cycle-start-title> \
  --issue-url <canonical-url> --issue-updated-at <updatedAt> \
  --issue-body <issue-body-file> \
  --requirements <canonical-requirements-json> \
  --document <design-json> --kind design \
  --goal-document <design-goal-json>
```

schema v4 `validation.target_state` は完成状態の唯一の正本である。automated
`verification_cases` は `verification_profile_id` と typed `selector` だけを持ち、
`command` を持たない。selector は profile 固定 suite 全体を表す
`{"kind":"suite"}`、または単一 test を表す
`{"kind":"test_case","path":"<repo-relative>","name":"<exact name>"}` である。
manual case は concrete `procedure` だけを持つ。procedureは空白、記号、symbol、
control / combining markを除いたUnicode文字を8文字以上持つ場合だけ実質的とみなす。

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
rules、target state、ownership scopes、baseline inventory、Git `HEAD`、profile catalog
と selected profile hash を同じ snapshot から固定する。Build Goal 作成前と Build
完了直前に同じ receipt hash で Build Entry を実行する。

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

runner は catalog の fixed argv だけを直接実行し、artifact の command や locator
metadata から実行方法を組み立てない。test-case adapter は実行 path / name が selector
と完全一致し、passed identity がちょうど1件の場合だけ成功する。各 result は profile
ID / hash、typed selector、executed identities、exit code、stdout / stderr byte length、
`AIDD-output-v1` framing hash、同一 final-state hash を保持する。

case の欠落、余剰、重複、順序ずれ、profile drift、旧 command evidence、失敗 status、
不一致 runtime identity を拒否する。final-state manifest は task-owned regular file の
path、worktree 上の Git 投影 mode・content と target-state hash を固定する。これとは
別の verification 専用manifestで、各 case 前後のGit index entryのpresence・mode・
object ID・stageが不変であることを確認する。この分離により、Ship時の正常なstage /
commitでfinal-state hashを変えず、verification中のindex-only変更を拒否する。coverage は
receipt の Git baselineから実差分を得て、ownership scope、surface、path rule、
dependency closure を再検証し、artifact 由来 command を再実行しない。

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

```sh
/tmp/aidd-checker check-all --repo-root <repo-root>
/tmp/aidd-checker validate-phase-contract --repo-root <repo-root>
```

---
title: AIDD Checker Operations
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - schema-v5
  - verification
when_to_read:
  - Task、checkpoint、検証、ShipのCLIを実行するとき
---

# AIDD vNext operations

## 開始時のbinary

専用clean worktreeで、採用済みsourceからtask専用のrepository外binaryをbuildする。
以後は同じbinaryを使う。特にLearnでは変更後のcheckerへ置換しない。
`/tmp/aidd-task-checker`は説明用pathであり、実運用ではtaskごとに一意なpathを使う。

```sh
go build -C tools/aidd/checker -o /tmp/aidd-task-checker ./cmd/aidd-checker
/tmp/aidd-task-checker version
```

Go cacheの通常pathに書込できない環境では、repository外の一時GOCACHEを明示する。
既存binaryを無条件に再利用しない。CoreはGoalやHookを呼び出さない。

## Task contract

sourceはrepository外のregular non-symlink JSON。出典本文を取得した後にSHA-256を計算する。
`action: execute`は実行依頼からのみ設定する。質問・説明・調査をexecuteへ読み替えない。

```json
{
  "schema_version": 5,
  "kind": "development",
  "action": "execute",
  "id": "issue-123-cycle-1",
  "intent": {
    "kind": "issue",
    "reference": "https://github.com/kosnu/savings/issues/123",
    "body": "取得したIssue本文",
    "body_sha256": "本文bytesのSHA-256"
  },
  "objective": "今回の実行で達成する結果",
  "constraints": ["守るべき境界"],
  "done": ["観測可能な完了条件"],
  "verification": ["必要な検証と確認対象"],
  "delivery": "local"
}
```

`delivery`はlocalまたはpr。localはfinishまでで、ship-checkとci-checkはpr以外を拒否する。
Coreの成功はmerge/deploy権限を与えない。
Learnは`kind: learn`、`intent.kind: feedback`とし、Issue URLは不要。
明示的な変更依頼の`authorization`と、`authorized_scopes: [{"path":"対象","kind":"file"}]`
を追加する。pathは有限のfile/tree。product pathは許可scopeへ含めても変更できない。

```sh
/tmp/aidd-task-checker task-start --repo-root . --source /tmp/task-spec.json
```

出力されたtask SHA-256を保持する。正本は`.aidd/tasks/<id>/task.json`。
Taskは開始時HEAD、全non-ignored baseline、policy/rule-map/profileのbytes、checker hashを固定する。
既存Taskを上書きせず、baselineを取り直さない。Taskの開始前に実装を持ち込まない。

## Decision / checkpoint

Decision sourceはschema_version 5、kind decision、task_sha256、reason、requirements、
target_state、additional_rulesを持つ。

requirementsは`id`、`text`、`origin`、`evidence`を持つ。originはintent/guardrail/derived。
intentのevidenceは本文の実在span、guardrailはrule ID、derivedは導出理由を記録する。
TaskのDoneが要求と検証に展開されていることはreviewで確認する。

target_stateは既存のtyped構造を継承する。

- product_behaviors: PB-ID、type（user_operation/state_transition）、description、requirement_id。
  Learnではguardrailの観測可能な効果を表し、product実装の許可を意味しない。
- verification_cases: VC-ID、type、requirement_id、product_behavior_ids。
  automatedはverification_profile_idとselector、manualはprocedureだけを持つ。
- ownership_scopes: 正規化されたpathとfile/tree。重複、app全体scope、checker出力scopeを拒否。
- representations: REP-ID、kind、path、locator、requirement_id、product_behavior_ids、verification_case_ids。
  locatorはfile/export/test_caseのmetadataであり、source構文の推論には使わない。

IDとscopeは既存の数値順・path順を使う。固定headingやphase Goalの本文は不要。
additional_rulesは自動routingで得られない探索上の必要rule ID。必須ruleを除外する用途には使わない。

```sh
/tmp/aidd-task-checker checkpoint --repo-root . --task issue-123-cycle-1 \
  --task-sha256 <task-hash> --source /tmp/decision.json
```

改訂時は同じcommandへ`--checkpoint-sha256 <最新checkpoint-hash>`を追加する。
checkpointは`checkpoints/000001.json`から追記され、Taskと全履歴を再検証する。
reasonへ変更・削除した判断と根拠を記録する。旧checkpointやbaselineを上書きしない。

## Verification

formatter等の意図的な変更を先に完了し、最終状態を固定してから実行する。
WebではAGENTS.mdの対象検証を満たす。Storybook browser-test対象を変更した場合は
該当profileをDecisionへ含める。変更前または現在のStoryにbrowser-testがある場合はCoreも要求する。API専用verificationが未定義であることを成功証拠へ置き換えない。

```sh
/tmp/aidd-task-checker verify --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash>
```

manual caseには`--manual-observation 'VC-2=具体的に観測した結果'`を追加する。
観測なしの成功を記載しない。失敗は範囲内で修正後に新しいbatchで再実行する。
runnerはprofile固定argv、process group、runtime identity、repository mutationを検査する。
成功出力のevidence hashを保持する。正本は`evidence/<checkpoint-hash>.json`。

```sh
/tmp/aidd-task-checker check --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash>
```

改訂または対象変更で旧証拠は失効する。全caseを再実行する。
`check`は整合検査であり、意味的reviewやLearn確定の代わりではない。

## Learn確定

変更開始時のbinaryでverifyを完了する。独立review担当が具体的な維持保証と契約変更を確認し、
明示的な確定許可とともにrepository外のreview JSONへ記録する。
必須fieldはschema_version=5、kind=learn_review、task_sha256、checkpoint_sha256、
evidence_sha256、reviewer、authorization、observations。

```sh
/tmp/aidd-task-checker learn-review --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash> --source /tmp/review.json \
  --source-sha256 <review-file-hash>
```

local完了前にも`finish --repo-root . --task <id> --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> --evidence-sha256 <evidence-hash>`を実行する。
finishはLearnの最新reviewを必須とし、delivery=prではstaged検査も行う。

reviewをテスト出力から作らない。記録は署名ではなく、確認者と許可の正当性は実行契約が所有する。
Learnの完了には最新reviewが必要。product実装が必要なら既存Issueへhandoffして終了する。

## Ship / CI

依頼された範囲だけをstageし、commit前に検査する。

```sh
/tmp/aidd-task-checker ship-check --repo-root . --task <id> \
  --task-sha256 <task-hash> --checkpoint-sha256 <checkpoint-hash> \
  --evidence-sha256 <evidence-hash>
```

内容やmodeの不一致、未stage出力、未検証変更があればcommitしない。Learnは最新reviewも検査する。
公開操作とread-backは実行adapterが行う。Core gate成功だけではpush/PR完了ではない。

commit後のCIは現在のPR target base側のcheckerをbuildし、clean candidateで次を実行する。

```sh
/tmp/base-aidd-checker ci-check --repo-root . --base <PR-merge-base>
```

変更されたTaskは1件に特定する。初期版は1 PR=1 taskとし、Task baselineとPR merge-baseの一致、
開始時policy/profileとGit baseline、最終content/Git mode、rule/ownership/verificationを検査する。
初回vNext導入PRだけは現在のtarget baseとmerge-baseの両方にv5がないため、candidateの回帰検証と独立reviewでbootstrapする。
古い分岐PRでも現在のtarget baseにv5があれば通常経路を使う。merge-baseにTask基準のv5がない場合は
bootstrapへfallbackせず失敗し、最新baseへ追従して適切なTask/evidenceを準備する。
`bootstrap-check --repo-root . --base <merge-base> --target-base <current-base>`はvnext-bootstrap.jsonの独立reviewと
対象差分のcontent/Git mode/pathを照合する。記録欠落・差分変更・現在のtarget baseまたはmerge-baseに既存v5がある場合は拒否する。
manifestから除外するのはbootstrapとverificationの記録JSONだけで、実装・設定・正本文書は含める。
reviewerの真正性はLearnと同じ運用境界で扱う。
この初回を既存v5基準による検証済みとは報告しない。v5導入後はtask欠落を成功扱いにしない。

## Repository verification

具体的な必須commandは次のとおり。

```sh
go -C tools/aidd/checker mod verify
gofmt -l tools/aidd/checker
go -C tools/aidd/checker vet ./...
go -C tools/aidd/checker test ./...
go build -C tools/aidd/checker -o /tmp/aidd-candidate-checker ./cmd/aidd-checker
/tmp/aidd-candidate-checker check-all --repo-root .
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/main
git diff --check
```

check-configは現行policyのglob、必須suite profile、rule-map、正本文書参照を検査する。
check-allは同じ設定検査と過去Requirements/Designの読取・表示同期を検査する。新規phase実行や旧receipt昇格は行わない。

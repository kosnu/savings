---
title: AIDD v4 Core操作
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

# AIDD v4 Core操作

repository rootで実行する。Go versionは`tools/aidd/checker/go.mod`に従う。

```sh
go -C tools/aidd/checker build -o /tmp/aidd-v4 ./cmd/aidd-checker
/tmp/aidd-v4 --root . start --task example --input /tmp/start.json
/tmp/aidd-v4 --root . decision --task example --input /tmp/decision.json
/tmp/aidd-v4 --root . verify --task example
/tmp/aidd-v4 --root . review --task example --input /tmp/review.json
/tmp/aidd-v4 --root . status --task example
```

Coreを変更したら現在sourceからbinaryを作り直す。古いbinaryの成功を新実装の証拠にしない。
Go cacheに書込できない環境では、repository外の書込可能な`GOCACHE`を指定する。
Taskの再開では`status`と該当eventを読み、Intent、最新decision、未達条件、証拠、承認を確認する。

## 入力

`start`のJSON例。baselineは開始HEADの完全SHA。textに実際の取得本文を保存する。

```json
{
  "intent": {
    "source": "https://github.com/owner/repo/issues/123",
    "text": "実際のIntent本文",
    "objective": "観測できる成果",
    "constraints": ["守る境界"],
    "acceptance": ["結果から判定する条件"]
  },
  "authority": "実行を明示したユーザー発言の出典と本文",
  "baseline": "開始時HEADの完全SHA",
  "initial_changes_acknowledged": false
}
```

`decision`は`summary`、`paths`、`commands`、`rules`を持つ。
pathsはexact fileまたは末尾`/`の有限directory。globやrepository全体の指定で権限を広げない。
commandsはrepository rootをcwdにするargv配列の配列。
Intentを訂正する場合は`intent_revision`へ新しい出典を持つIntent全体を指定する。元のIntentは保持される。
Audit後のIntent訂正には、予約対象`@intent`を含む提案への手動承認が必要になる。
`@intent`はTask内のIntent改訂だけを指し、外部Issue編集の権限や任意ファイルの変更権限を与えない。
rulesはrule ID配列。選択結果に意味的関連ruleを追加し、各本文を読む。

```json
{
  "summary": "採用する判断、理由、未解決事項",
  "paths": ["tools/aidd/checker/"],
  "commands": [
    ["go", "-C", "tools/aidd/checker", "test", "-count=1", "./..."],
    ["go", "-C", "tools/aidd/checker", "vet", "./..."],
    ["git", "diff", "--check"]
  ],
  "rules": ["実際に選択された全rule ID"]
}
```

`rules --paths /tmp/paths.json`は変更pathのJSON文字列配列から必須ruleと依存closureを返す。
`review`は`summary`、`rules`、`criteria`を持つ。criteriaは各`criterion`、`evidence`、`verdict`。
criterionはIntent acceptanceと対応し、verdictは`pass`、`fail`、`unknown`。
根拠不足をpassにせず、修正・再検証または必要な人間判断につなげる。

## セッション計測

CodexのAIDD作業で実際に行う工程を、開始・終了時に記録する。`--stage`には
`Intent`（確認・復帰）、`調査`、`設計`、`実装`、`検証`、`レビュー`、`Ship`、`Audit`、`改善`（承認されたガードレール改善）
のいずれか一つを指定する。これは計測用の工程名であり、必須工程や実行順序を追加するものではない。
「設計・実装」など複数工程をまとめた名前や任意名は拒否する。工程が変わるときは`finish`してから
次の工程を`start`し、同じ工程に戻る場合も新しい記録を開始する。
Task IDを渡すと、現行サイクルIDを`.aidd/v4/<task-id>/events/`から取得する。
計測CLIはChecker Coreと別のGo moduleに置き、独立して実行する。
セッションIDには`CODEX_SESSION_ID`を使い、ない環境では`--session`で明示する。

```sh
go -C tools/aidd/session-metrics run . start --root "$PWD" --task issue-123 --stage 設計
go -C tools/aidd/session-metrics run . finish --root "$PWD" --task issue-123
go -C tools/aidd/session-metrics run . start --root "$PWD" --task issue-123 --stage 実装
go -C tools/aidd/session-metrics run . finish --root "$PWD" --task issue-123
go -C tools/aidd/session-metrics run . report --root "$PWD" --task issue-123
go -C tools/aidd/session-metrics run . report --root "$PWD" --since 2026-09-21
```

記録は既定でこのrepositoryのGit common directory内の`aidd-metrics/usage.jsonl`に置く。
worktree間で共有され、commitやPRの差分には入らない。別の保存先が必要なら`--store`を指定する。
Codex transcriptからセッションの累積トークン使用量を読み、
開始・終了時の観測値の差を保存する。transcriptの形式は安定した公開契約ではないため、見つからない、
新しい観測値がない、または形式が変わった場合はトークン数を取得不可にする。時間は開始・終了間の経過時間を単調時計で測る。
ユーザー入力待ちを作業時間に含めない場合は、待機前に`finish`し、再開時に新しい記録を開始する。
`report`はJSONで次の集計を返す。`--task`、`--cycle`、`--session`、`--since`の絞り込みは全ての集計に適用する。

- `records`: セッション・Task・サイクル・工程を保持した終了済み記録。
- `groups`: 既存のTask・サイクル別の合計。
- `stage_groups`: Task・サイクル・工程別の合計。同じ工程の繰り返しや複数セッション分を合算する。

各集計は`duration_seconds`（秒）、`total_tokens`、`records`（記録数）、`sessions`（セッション一覧）を持つ。
時間またはトークン数が一件でも欠ける場合、その項目の合計は`null`（不明）とし、既知分だけの小計を合計として表示しない。
欠測の影響は該当工程とそのTask・サイクルの合計に限られ、他工程の既知値は保持する。未終了の記録は集計しない。
過去の任意名・複合名の記録は原文の`stage`を保持し、工程別集計に`legacy_stage: true`を付ける。
過去の時間・トークンを推測で工程へ分配せず、Task・サイクル合計には引き続き含める。
`finish`の計測結果と必要な`report`結果を、作業したCodexセッションのメッセージとして返す。
サイクルを切り替える前に進行中の工程を終了し、別サイクルへ時間やトークンを付け替えない。
この記録は個人の振り返り用であり、AIDD Coreの証拠やPR本文・テンプレートには含めない。
計測ツールのGoテストはPR CIでCoreと別に実行する。

## Ship

必要なstageをGit Workflowに沿って行い、証拠を含むTask記録もstageする。

```sh
/tmp/aidd-v4 --root . ship-check --task example
```

合格後にcommit、push、PR作成/更新とread-backを行う。
`ship --input /tmp/ship.json`へ`commit`、`remote`、`branch`、`base`、`pr`、`evidence`を渡す。`ship`は配信先を照合して結果を返すだけで、eventを追加しない。
baseは期待するマージ先ブランチ名（例: main）を指定する。Coreは実commit・remote・PR head・base名を確認する。baseのSHAは取得条件に含めず、同名ブランチの更新は拒否しない。evidenceにはtracking/upstream、base、CIの一度の取得結果などを記す。

配信先、commit、PRはShip結果として報告する。後から再開するときはTaskとPRを確認し、未確認の配信を成功と推測しない。
旧TaskのShip eventは読み取りを維持する。`delivery-check`は既存の記録だけの配信確認に限る。
sourceの変更があれば同じTaskで必要な新revision・再検証・review・Shipを行う。

## Auditと承認後の改善

AuditはShip後のユーザーの明示依頼を受けて実行する。TaskとPRを照合し、その時点のレビュー指摘を確認する。
`audit --input`は次の構造。新しいTaskでは`delivery`に対象配信を指定する。Coreはreview済みcommitとPRを照合する。旧TaskのShip eventは引き続き参照できる。

```json
{
  "summary": "成果と振り返りの結論",
  "delivery": {
    "commit": "Audit対象のcommit SHA",
    "remote": "origin",
    "branch": "配信ブランチ名",
    "base": "main",
    "pr": "PR URL",
    "evidence": "配信確認結果"
  },
  "findings": ["指摘と対応状態"],
  "session_improvements": ["進め方について観測したこと"],
  "proposals": [
    {
      "id": "P1",
      "finding": "根拠に基づく問題・原因",
      "evidence": "セッションや検証の具体的な参照",
      "change": "改善内容と確認方法",
      "paths": ["docs/harness/policies/example.md"]
    }
  ]
}
```

改善提案がなければ結果を報告し、Audit eventを追加せずに終了する。提案があればTaskへ記録してユーザーに提示し、手動承認を受けるまで改善へ進まない。記録は承認された改善の変更と一緒にcommitする。
`approve --input`は`audit_hash`、`source`、`text`、`proposal_ids`を持つ。
source/textはその提案を承認した実際のユーザー発言。agentが生成した同意を使わない。
一部だけ承認した場合、未承認案は次のAuditに引き継ぐ。却下はユーザーが明示した場合だけ
`dismiss --input`へ同じ形式で記録し、改善済みとは区別する。
旧Taskで記録済みの提案なしAuditは、従来どおり空のproposal_idsによる承認を受け付ける。
「Auditを承認します」は提示した改善案への承認であり、別の実行承認を要求しない。
同じShip内容・revisionに追加指摘があればauditを再実行する。audit-updateとして追記され、未決提案は保持し、旧承認は失効する。
承認後に改善のdecisionを追記し、`improve-check`で承認対象との一致を確認しながら改善する。
改善後、現在のIntentと改善済みガードレールを読み直して次の境界を記録する。

```sh
/tmp/aidd-v4 --root . return-intent --task example --input /tmp/return-intent.json
```

入力は`{"summary":"Intentと改善済みガードレールを再確認した具体的な結果"}`。
Coreが新しいcycle IDを発行し、現在Intentのhashと承認への参照を保存する。
再開時はstatusの`cycle_id`と境界eventを読み、同じ操作を繰り返してIDを増やさない。
その後、次サイクルのdecisionを記録し、必要な設計・実装、verify・review・Shipまで進む。次のAuditは手動開始後に記録する。
改善後の復帰を省略したShipと、前cycleのdecision・検証の流用は拒否される。
cycle ID導入前のv4履歴は変更せず、明示的な復帰から採番する。
旧Taskの改善案なしAuditへの承認は終了を意味し、`return-intent`や実装の権限を付与しない。

## 検証とエラー

```sh
go -C tools/aidd/checker test -count=1 ./...
go -C tools/aidd/checker vet ./...
python3 -B -m unittest -v tools.aidd.tests.test_shared_gate
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/main
/tmp/aidd-v4 --root . check-all
/tmp/aidd-v4 --root . check-all --base origin/main
```

検証失敗・source変更は失敗記録を保持する。結果を編集せず、原因を修正して再実行する。
revisionやscopeの不一致は判断を確認し、必要なら新decisionにする。
承認不足・意図の矛盾は具体的な不足を提示してユーザー判断を待つ。
旧CLI引数や旧Taskはv4への自動変換を行わない。

## Repository verification

既存のstaged Git gateは変更したGoファイルをgofmtし、Go vetとvp checkを実行する。
これはTaskの必要検証とsemantic reviewの代替ではない。hookでsourceが変わった場合は
新しい状態をverifyしてからShipする。一般の非AIDD変更にもこの共通gateは適用される。

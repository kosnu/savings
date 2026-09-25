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

## Ship

必要なstageをGit Workflowに沿って行い、証拠を含むTask記録もstageする。

```sh
/tmp/aidd-v4 --root . ship-check --task example
```

合格後にcommit、push、PR作成/更新とread-backを行う。
`ship --input /tmp/ship.json`へ`commit`、`remote`、`branch`、`base`、`pr`、`evidence`を渡す。
baseは期待するマージ先ブランチ名（例: main）を指定する。Coreは実commit・remote・PR head・base名を確認する。baseのSHAは取得条件に含めず、同名ブランチの更新は拒否しない。evidenceにはtracking/upstream、base、CIの一度の取得結果などを記す。

ShipとAuditの追記記録はsource fingerprintから独立する。配信後の記録を追加commitで保存する場合は
記録のみの差分であることを確認し、最新HEAD/remote/PRを`delivery-check --task example --input /tmp/ship.json`で再確認する。
この操作は新eventを追加せず、配信後の記録が次の配信記録を要求する循環を避ける。
sourceの変更があれば記録保存扱いにせず、同じTaskで必要な新revision・再検証・review・Shipを行う。

## Auditと承認後の改善

`audit --input`は次の構造。実際に改善不要と判断した場合だけproposalsを空配列にする。

```json
{
  "summary": "成果と振り返りの結論",
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

ここで提案をユーザーに提示する。手動承認を受けるまで改善へ進まない。
`approve --input`は`audit_hash`、`source`、`text`、`proposal_ids`を持つ。
source/textはその提案を承認した実際のユーザー発言。agentが生成した同意を使わない。
一部だけ承認した場合、未承認案は次のAuditに引き継ぐ。却下はユーザーが明示した場合だけ
`dismiss --input`へ同じ形式で記録し、改善済みとは区別する。
提案のないAuditも明示承認が必要で、proposal_idsを空配列にしてapproveする。この承認は改善実行を許可しない。
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
その後、次サイクルのdecisionを記録し、必要な設計・実装、verify・review・Ship・Auditへ進む。
改善後の復帰を省略したShipと、前cycleのdecision・検証の流用は拒否される。
cycle ID導入前のv4履歴は変更せず、明示的な復帰から採番する。
改善案なしのAuditへの承認は終了を意味し、`return-intent`や実装の権限を付与しない。

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

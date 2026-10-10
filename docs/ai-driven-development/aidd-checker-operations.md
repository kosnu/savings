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

# AIDD Core操作

repository rootで現在sourceから実行する。Go versionは`tools/aidd/checker/go.mod`に従い、Core変更後はbinaryを作り直す。commandのstdout/stderrをファイルへredirectしたり、結果の要約へ貼り付けたりしない。

```sh
go -C tools/aidd/checker build -o /tmp/aidd-checker ./cmd/aidd-checker
/tmp/aidd-checker --root . rules
/tmp/aidd-checker --root . check-changes --base origin/main
```

`rules --paths`にはJSONのpath配列を入力できる。全規約graphの検査は`rules`、実差分の選択は`check-changes`で行う。
これらの成功はテスト・レビューの完了ではない。

## 検証

変更対象の既存formatterを検証前に適用する。Markdownは`vp fmt <変更path...> --write`、Goは`gofmt -w <変更Goファイル...>`を使う。

必要な検証は[AGENTS.md](../../AGENTS.md#verification)と適用規約から選ぶ。
Coreでまとめて実行する場合、`verify --base <比較元commit/ref> --input <一時JSON>`を使う。
たとえばCore変更の入力は次の形にする。`rules`は実際の差分に必要なrule IDを指定する。

```json
{
  "paths": ["tools/aidd/checker/"],
  "commands": [
    ["git", "diff", "--check"],
    ["go", "-C", "tools/aidd/checker", "test", "./..."],
    ["go", "-C", "tools/aidd/checker", "vet", "./..."]
  ],
  "rules": [
    "ai-driven.workflow",
    "ai-driven.checker",
    "documentation.policy",
    "ai-driven.change-coverage",
    "ai-driven.overview",
    "ai-driven.glossary"
  ]
}
```

入力はその場の実行にだけ使用し、Task・snapshot・出力・操作履歴を生成しない。入力ファイルを使った場合は実行後に削除する。
結果は各commandのindexと終了コード、`stable`のみ。診断出力は実行中に確認し、要約は検証名・成否・必要な未確認事項に絞る。
Webの整形は検証batchの前に行う。失敗修正後は開始済みbatchを終えてから必要な検証をやり直す。
同一差分で確認済みの検証を、記録更新のために再実行しない。

## stageと配信確認

必要な検証とレビュー後に担当差分をstageし、`ship-check`を使う。
commit hookが内容やmodeを変えた場合は変更された内容を確認し、影響する検証・レビューを実施する。
commit・push・PR作成後、次の配信入力を`ship --input <一時JSON>`で照合する。

```json
{
  "commit": "<local HEAD>",
  "remote": "origin",
  "branch": "<branch>",
  "pr": "<PR URL>",
  "base": "main"
}
```

tracking ref・upstream・CIの確認は[Git Workflow](../harness/policies/git-workflow.md)に従う。
Coreの結果だけで未実施の検証・レビュー・CIを成功にしない。配信後に記録ファイルを追加しない。

## Core・CI・hookの検証

```sh
go -C tools/aidd/checker test ./...
go -C tools/aidd/checker vet ./...
go -C tools/aidd/session-metrics test ./...
go -C tools/aidd/session-metrics vet ./...
python3 -B -m unittest -v tools.aidd.tests.test_shared_gate
python3 -B docs/harness/scripts/validate_accepted_adrs.py --repo-root . --base-ref origin/main
```

CIはcandidateの実差分・規約graph・Core test/vet・共有Git gate・ADR履歴を確認する。
Taskの有無によるgateと、記録だけを理由にした自動依存更新の例外は設けない。
既存hookはstageに必要な検査を維持し、旧Task/eventを要求しない。旧Codex lifecycle hookは現行の入口ではない。

## セッション計測

工程ごとの計測記録は通常開発で要求しない。明示依頼による計測やRetrospectiveに既存session-metricsを利用できるが、
新たな操作履歴の義務やShip条件にはせず、コマンド生出力は保存しない。
任意計測は旧Task/eventがなくても実行でき、cycleは空値となる。旧記録がある場合だけ既存cycleの読み取りを維持する。

再開・Auditの権限判断は[Codex adapter](codex-adapter.md#再開)と[Workflow](workflow.md)から確認する。

## Repository verification

既存のstaged Git gateは変更したGoファイルをgofmtし、Go vetとvp checkを実行する。
これは必要検証とsemantic reviewの代替ではない。hookでsourceが変わった場合は
影響する検証を行ってからShipする。一般の非AIDD変更にもこの共通gateは適用される。

実行環境の設定はcommand argvへ埋め込まず、Coreのbuildやverifyの呼出環境から継承する。
Go cacheに書き込めない場合はrepository外の書き込み可能な`GOCACHE`を指定する。

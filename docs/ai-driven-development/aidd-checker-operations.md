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

`rules --paths`には、JSONのpath配列そのものではなく、その配列を保存したファイルのパスを渡す。
たとえば、この操作文書に適用される規約を選ぶ場合は、repository rootで次を実行する。

```sh
cat > /tmp/aidd-rule-paths.json <<'JSON'
["docs/ai-driven-development/aidd-checker-operations.md"]
JSON
/tmp/aidd-checker --root . rules --paths /tmp/aidd-rule-paths.json
rm /tmp/aidd-rule-paths.json
```

配列の各要素はrepository rootからの相対pathで指定する。この例では`ai-driven.checker`や`documentation.policy`など、
対象pathに直接一致する規約・surface必須規約と、その依存closureが選ばれる。
結果は実行中の表示だけで確認し、確認後は一時入力ファイルを削除する。stdout/stderrをファイルへ保存しない。

全規約graphの検査は`rules`、実差分の選択は`check-changes`で行う。
これらの成功はテスト・レビューの完了ではない。

## 検証

変更対象の既存formatterを検証前に適用する。Markdownは`vp fmt <変更path...> --write`、Goは`gofmt -w <変更Goファイル...>`を使う。

必要な検証は[AGENTS.md](../../AGENTS.md#verification)と適用規約から選ぶ。
Coreでまとめて実行する場合、`verify --base <比較元commit/ref> --input <一時JSON>`を使う。
工程結果は`record-begin`で検証を開始し、`verify`を実行してから`record-finish`で成否を保存する。入力の`paths`には実際の変更対象を指定する。[Coreの検査範囲](aidd-checker.md#検査の責務)に従い、所定の工程結果の追加・更新を`paths`へ足す必要はない。他の範囲外変更や検証中の内容・mode変更は引き続き失敗となる。
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

入力はその場の実行にだけ使用し、Task本文・snapshot・生出力・操作履歴を生成しない。入力ファイルを使った場合は実行後に削除する。
結果は各commandのindexと終了コード、`stable`のみ。診断出力は実行中に確認し、要約は検証名・成否・必要な未確認事項に絞る。
Webの整形は検証batchの前に行う。失敗修正後は開始済みbatchを終えてから必要な検証をやり直す。
同一差分で確認済みの検証を、記録更新のために再実行しない。

## 工程結果の更新

### Taskと記録先の選択

最初に[WorkflowのTask判断](workflow.md#taskの開始と継続)で開始・継続・unknownを決める。
その後でサイクルと工程を選び、[記録契約](aidd-checker.md#記録)に従って操作する。
`--task`は判定したTaskの作業名、`--cycle`はそのTask内のdesign記録名、`--kind`は実際に行う工程を指定する。
Issue番号を含む作業名でも、同じIssueの全作業を保存するdirectoryとは解釈しない。
`record-finish --record`には、対応する`record-begin`が返したpathを渡す。

以下は記録先を説明する仮例であり、実在Taskの分類ではない。
既存Taskの作業名を`example-work`とし、現在のcycleが`000001.json`、そのdesign・verify・reviewがそれぞれ`000001.json`・`000002.json`・`000003.json`にある場合を示す。

| 得られた根拠と判定                                                                                                          | 追加・更新先と操作                                                                                                    | 保持する結果                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 同じ監視Issueで、telemetry送信停止を完了したTaskとは別に、Dev実受信の確認が独立した成果として新しく委任された               | 新Taskの別名`example-other-work`でcycleなしのdesignを開始し、`.aidd/v4/example-other-work/events/000001.json`を追加   | `example-work/events/`全件                                    |
| telemetry送信停止の成果を継続し、PRを作り直す。元の担当範囲・baseline・未解決事項を引き継ぎ、同じサイクルの設計を再確認する | `--task example-work --cycle 000001.json --kind design`で既存`000001.json`を更新                                      | 別Task・過去cycleの全件と、このcycleの他工程                  |
| 同じTask・同じサイクルでverifyを再試行する                                                                                  | `--task example-work --cycle 000001.json --kind verify`で既存`000002.json`をrunningへ更新し、実検証後に同pathをfinish | 他工程と別Task・過去cycleの全件。旧passは現在の成功に使わない |
| 同じTaskで手動開始Audit・改善承認・改善後のIntent再読を経て、次サイクルへ進む                                               | `--task example-work --kind design`で新designを追加。返された記録名を新cycleとしてverify・reviewへ渡す                | 前cycle全件を凍結し、別Taskも保持                             |
| Issue・PR番号の一致しかなく、同じ成果・作業境界を継続する根拠が不足している                                                 | unknown。`record-begin`・`record-finish`を行わず、既存Issue・PR・会話から不足する根拠を取得する                       | 全件。新Taskや次cycleの追加で判定不足を回避しない             |

PR番号が変わっても、サイクルの判断はTask内の作業の意味と承認対象から行う。
次サイクルの例ではAudit記録も先に追加されるため、新designの連番を`000004.json`などに決め打ちしない。
cycle省略のdesignは毎回新cycleを作る。同じサイクルのdesign再確認には既存cycleを必ず指定する。
連番が大きいことを新Taskの根拠にせず、別Task・旧cycleを現在の保存先に変更しない。
Taskの判断をCoreの成功で代替せず、既存結果の再利用には`record-read`の鮮度照合も必要になる。

### begin・finish・read

以下の作業名・参照・対象pathは実際のTask判断に合わせて置き換える。
新Taskの最初のサイクル、または同じTaskの次サイクルと判断したdesignだけcycleを省略し、返された記録名を以後の工程へ渡す。

開始入力は参照と確認対象だけにする。

```json
{
  "source": "https://github.com/kosnu/savings/issues/1903",
  "paths": ["tools/aidd/checker/", "docs/ai-driven-development/"]
}
```

```sh
/tmp/aidd-checker --root . record-begin --task issue-1903 --kind design --input /tmp/phase-start.json
/tmp/aidd-checker --root . record-begin --task issue-1903 --cycle 000001.json --kind verify --input /tmp/phase-start.json
```

実際の起点・返されたrecord pathへ置き換える。工程の開始前にrunningへ更新し、検証・レビューは従来の実行手順で行う。失敗・中断時は成功へ更新しない。完了入力には生出力・argvを渡さない。

```json
{
  "status": "pass",
  "checks": ["Core test/vet"],
  "summary": "対象変更なしで検証成功。",
  "remaining": []
}
```

```sh
/tmp/aidd-checker --root . record-finish --record .aidd/v4/issue-1903/events/000002.json --input /tmp/phase-result.json
/tmp/aidd-checker --root . record-read --record .aidd/v4/issue-1903/events/000002.json
```

失敗はfailと短い原因・残る問題、証拠不足はunknownにする。`record-read`がunknownなら以前のpassを現在の成功にしない。同じcycle・kindの再試行は同じファイルへbegin/finishする。次サイクルは新designを作り、前cycleは変更できない。
入力JSONは実行後に削除する。工程結果を更新するたびのcommit、Shipの結果ファイル、配信確認の記録だけを目的とした追加commitは作らない。Audit記録から実行許可を推論しない。

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
作業名の受理条件は[Coreの記録契約](aidd-checker.md#記録)を共通で適用する。
任意計測はTask記録がなくても、新しい工程結果（`aidd-phase-result-v1`）があっても実行でき、計測のcycleは空値となる。
最新のJSONが旧eventの場合だけ既存の`cycle_id`を読み取る。旧eventと新工程結果が混在していても、最新のJSONが新工程結果なら空値とし、過去の旧cycleへ紐付けない。工程結果のcycleを旧計測cycleへ変換せず、記録や工程を追加しない。

再開・Auditの権限判断は[Codex adapter](codex-adapter.md#再開)と[Workflow](workflow.md)から確認する。

## Repository verification

既存のstaged Git gateは変更したGoファイルのgofmt整形状態を確認し、Go vetとvp checkを実行する。
hookは自動修正せず、整形漏れや検査エラーでcommitを止める。整形・自動修正は必要な検証の前に実行する。
未ステージ差分は検査中に一時退避・復元し、ステージ済みの内容を検査する。
これは必要検証とsemantic reviewの代替ではない。一般の非AIDD変更にもこの共通gateは適用される。

実行環境の設定はcommand argvへ埋め込まず、Coreのbuildやverifyの呼出環境から継承する。
Go cacheに書き込めない場合はrepository外の書き込み可能な`GOCACHE`を指定する。

---
title: Compact AIDD Records and Agent Input
doc_type: guide
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - schema-v6
when_to_read:
  - AIDDの記録形式と短い入出力を変更するとき
---

# v6の保存・復元契約

採用判断は[ADR-0005](../adr/0005-compact-aidd-records.md)に記録する。

Task / Decision / Checkpoint / Evidenceの意味と権限は[workflow](workflow.md)を維持する。
v6はGitから復元できるbytesの重複保存と、agentによる判断全文の再入力を減らす。
履歴、意図、許可、必須検証を要約やhashだけで代替しない。

## 保存するもの

| 記録       | v6で保存する内容                                                                                | 検査時に復元する内容                      |
| ---------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Task       | spec、固定baseline commit、checker hash、必要な権限例外                                         | 全baseline、開始時policy/rule-map/catalog |
| Checkpoint | 完全なDecision、revision/parent/Task hash、rule closure、rule-map参照                           | そのrevisionのrule-map bytes              |
| Evidence   | Task/checkpoint/checker identity、ローカル状態digest、Git状態digest、変更path、構造化runner結果 | 現在の全ソースinventoryと変更基準との差分 |

specのintent本文は外部Issueが後から変わっても再現できるよう保持する。
開始時のGit commitは完全SHAで固定し、branch名から再解決しない。必要なobjectがない場合は
失敗する。agent/CIが該当履歴を取得し、再検査する。現在の設定へのfallbackはない。

Task開始時はclean状態とGit treeを照合する。内容・Git mode・pathが復元できない状態では開始しない。
Gitが保存しない通常権限のうち、regular fileの0644/0755、symlinkの0777から異なるものだけを
`baseline_modes`へ記録する。例外は正規path順で、存在するfileとGit実行権限へ照合する。
checker生成記録の権限は各record読取時に別途検査する。全ソースの初期権限を一律に変更しない。
保存量は契約の長さと権限例外数に依存するが、通常権限の未変更file数には比例しない。

rule-mapがTask開始時と同じ場合は`rule_map_ref.sha256`で開始時bytesへ結合する。
異なる場合は`rule_map_ref.snapshot=true`とし、Task内の
`snapshots/<sha256>.json`へ一度保存する。同じTaskの改訂間で共有し、Taskをまたぐ外部object storeは作らない。
snapshotはschema_version=6、kind=rule_map_snapshot、元bytesを保持するJSON stringのcontentを持つ。
元bytesのhashを照合してから索引としてparseする。snapshotの欠落・変更・未参照出力を拒否する。
改訂履歴の意味を過去commitへ巻き戻さず、各checkpointが参照した索引でrule closureを検査する。

## 全体検証と小さなEvidence

検証前後と証跡検査では、Git管理対象と未ignoreの新規fileを全走査する。
path、type、mode、content hashを含む整列inventoryのcanonical hashを保持する。
ローカルの`repository_sha256`とGit modeへ正規化した`git_repository_sha256`を分離し、
ローカルでは両方、CIではGit digestを照合する。0600などのローカルmode変更もローカル検査で検出する。

変更pathはTask baselineまたは明示されたintegration baseから再計算する。
ownership、representation、rule closure、必須profile、HEAD/index、staged状態、
複数TaskのPR全差分coverageは従来の検査を共有する。全inventory配列の保存を省いても
走査や未追跡file検査は省かない。生成記録はソースdigestから分離し、履歴・参照・modeを個別に検査する。

runnerの証跡契約は引き続きv5であり、外側の保存形式だけv6とする。
結果はJSON objectとして保持し、base64で埋め込まない。読取時にrunnerのcanonical bytesを復元して
厳密なdecoderへ渡す。case結果、profile/selector、実行identity、終了code、stdout/stderrのbyte数、
出力hash、最終state、手動観察を保持する。stdout全文は従来から保存しておらず、
新しいログ保管サービスや独自の詳細ログ記録は追加しない。

## agentの入力と表示

通常操作は[operations](aidd-checker-operations.md#短い通常操作v6)を使う。

- `task-start`はschema省略時に6を使い、intent本文hash省略時に実bytesから計算する。
  action=execute、意図、許可、完了条件を推測しない。新規CLIでv5を作成しない。
- `checkpoint --latest --expect-revision N`は明示Taskのidentityを解決し、入力にない
  schema/kind/task hashを補う。要求や参照先の意味はagentが記述する。
- `decision-update`はreasonと必要なcollectionのupsert/removeだけを受け取る。
  requirements、product_behaviors、verification_cases、representationsはID、ownership_scopesはpathがkey。
  空key、同じkeyへの重複操作、未知keyのremoveを拒否する。更新後に全Decisionを再検査する。
  並び順はcheckerが正規化する。要求とbehavior等の意味的な参照関係を自動推測しない。
- additional_rulesは指定時に置換する。integration/checker_migration/product_authorizationは
  指定時に更新し、省略時は引き継ぐ。保護された履歴の削除や権限拡張は既存検査で拒否する。
- scope_revisionは一回限りの範囲追加イベントであり、省略時は新Decisionに含めない。
  適用済みの権限とユーザーの制限は履歴から復元し、同じscopeの再追加は引き続き拒否する。
- `--latest`は明示Task IDと期待revisionを必須とする。任意の「最近のTask」へ切り替えない。
  hashを併記した場合は完全一致を要求する。古いrevisionは、読み直して判断するまで更新できない。
- `task-status`は読取専用で、summaryまたは指定fieldを返す。summaryのevidence_validは
  最新証跡の整合成功だけを意味する。IssueのDone、review、push/PRを自動達成と扱わない。

statusは既定2000文字、最大4000文字のpage。`next_offset`があれば情報が残っている。
同じTask/revisionで続きを取得し、revisionが変わっていたら読取をやり直す。
fieldはsummary/task/decision/requirements/product_behaviors/verification_cases/ownership_scopes/representations。
出力のcontentはJSONテキストの一部分であり、全pageを連結すれば元の表示JSONになる。

失敗出力も既定2000文字、最大4000文字で、元のdiagnostic codeと総文字数・継続位置を保持する。
`--diagnostic-offset`と`--diagnostic-limit`で詳細を明示取得できる。ただしcommandの再実行であり、
検証や対象状態が変われば診断も変わる。全findingを列挙したとは扱わず、最初の検査失敗を示す。
通常の成功出力は従来どおり1行。短い表示を正本や検証の省略理由にしない。

## 互換性と移行

v5 Taskの開始記録、checkpoint、Evidenceのbytes/hashは変更しない。
v5 Taskへの改訂と検証はv5形式を維持する。新しいCLIの短いidentity解決と差分入力はv5にも使えるが、
実行binaryの固定は解除しない。旧runner契約と任意learn-reviewのschemaも5のまま扱う。

この導入Task自身は開始時v5 checkerで検証できる範囲をv5で記録する。
新形式の機能はfixtureで検証する。旧Taskを再作成して軽量化しない。
実行checkerの変更が必要なら既存のchecker移行、旧baseに新形式記録を配信する場合は
[契約移行](aidd-checker-operations.md#非互換なchecker契約の移行)の承認境界を使う。
参照snapshotも通常のTask生成記録としてstage・配信する。旧記録削除、自動GCは実施しない。

## 比較検証

`TestCompactStorageGrowth`は同じ変更・判断・検証caseに対して未変更fileを100件追加し、
Task/checkpoint/Evidenceの合計bytesが増えないことを検査する。全走査の時間は別に扱う。
`TestCompactBenchmarkScenarios`は文書変更、アプリ変更、判断改訂を同じfixtureでv5/v6比較する。
生成bytes、agentのDecision入力bytes、成功出力bytes、通常command数、処理時間を分けて表示する。
command数は開始・checkpoint・verifyの3回、改訂を含む場合は4回。状態照会・再開は別途CLI回帰で検査する。
成功出力は実CLIと同じ形式の比較テキストで、会話履歴やモデルの内部推論tokenの実測ではない。

```sh
go -C tools/aidd/checker test ./internal/protocol -run 'TestCompactStorageGrowth|TestCompactBenchmarkScenarios' -count=1 -v
```

任意の`AIDD_COMPACT_METRICS`にrepository外の既存directoryを指定すると、比較入力・出力を
scenario別JSONへ保存できる。tokenを比較するときは同じtokenizer/versionでこのテキストだけを
計数し、保存量・課金量・実行時の推論量と区別する。初回のDecision入力と通常出力が元から小さい点も報告する。

### 2026-09-19の比較結果

小さなfixture（開始時ソース6件、変更1件、検証1case）の結果。実repository全体の削減率ではない。
入力tokenは比較対象のDecisionまたは改訂入力、出力tokenは上記の成功行だけを計数した。
`tiktoken 0.12.0 / o200k_base`を使用し、64桁のidentityは同一の固定hashへ置換して実行ごとの変動を除いた。

| scenario   | schema | 保存bytes | Decision入力bytes | 入力token | 成功出力bytes | 出力token | command数 |
| ---------- | ------ | --------: | ----------------: | --------: | ------------: | --------: | --------: |
| 文書変更   | v5     |     8,824 |             1,411 |       390 |           278 |       127 |         3 |
| 文書変更   | v6     |     4,365 |             1,281 |       334 |           269 |       121 |         3 |
| アプリ変更 | v5     |     8,812 |             1,403 |       388 |           278 |       127 |         3 |
| アプリ変更 | v6     |     4,353 |             1,273 |       332 |           269 |       121 |         3 |
| 判断改訂   | v5     |    11,194 |             1,384 |       386 |           372 |       169 |         4 |
| 判断改訂   | v6     |     6,271 |                49 |        12 |           365 |       162 |         4 |

判断改訂の入力tokenは386→12。通常成功出力は既に小さく、往復数は同じである。
未変更fileを100件追加してもv6記録の合計bytesは同一だった。
同じ環境の比較fixture実行時間はv5約0.8〜1.0秒、v6約1.4〜1.8秒で、Git復元の負担がある。
この計測から処理速度改善や実会話全体の課金削減率を主張しない。

再現用テキストの取得例（`/tmp/aidd-metrics`は空の一時directoryとして用意する）:

```sh
env AIDD_COMPACT_METRICS=/tmp/aidd-metrics go -C tools/aidd/checker test ./internal/protocol -run TestCompactBenchmarkScenarios -count=1 -v
```

独立した一時Python環境へ`tiktoken==0.12.0`を入れ、次のコードで同じ対象を計数する。
repositoryの実行依存やCoreへtokenizerは追加しない。

```python
import hashlib
import json
import pathlib
import re
import tiktoken

encoding = tiktoken.get_encoding("o200k_base")
identity = hashlib.sha256(b"aidd-comparison-identity").hexdigest()
for path in sorted(pathlib.Path("/tmp/aidd-metrics").glob("*.json")):
    row = json.loads(path.read_text())
    counts = [
        len(encoding.encode(re.sub(r"\b[0-9a-f]{64}\b", identity, row[field])))
        for field in ("decision_input", "success_output")
    ]
    print(row["scenario"], row["schema"], *counts)
```

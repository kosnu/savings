---
title: AIDD Change Coverage
doc_type: policy
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
  - docs/harness
topics:
  - ai-driven-development
  - change-coverage
when_to_read:
  - AIDDの仕組み、契約、実行入力を変更するとき
---

# AIDD変更のCoverageモデル

変更する概念から、検討するrepresentation、実行パターン、検証を結び付ける。
全項目を変更するための一覧ではない。`affected`、`unaffected`、`not-applicable`を理由付きで閉じる。
`rule-map`の「対象pathから読むルールを選ぶ」責務と併用し、ルール選択や実装許可を代替しない。

## 5件から得た検討軸

| 軸ID                 | 検討すること                                                          | 根拠となる修正                                                                                               |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| sequence             | 操作後の次の更新・再実行・再開、履歴と継続状態                        | [範囲追加イベントの再適用](https://github.com/kosnu/savings/commit/c2898502a51f30216ba00f4a8dc4243e6bec071d) |
| indirect-inputs      | 本体以外の設定・依存・profile・routingが変わる経路                    | [共有ゲートの実行入力漏れ](https://github.com/kosnu/savings/commit/7480372994f9ef22d87b0abddaee279e1ab4a38f) |
| execution-paths      | Development/Learn、review修正・追加Ship、旧Task/checker、main統合・CI | [移行時の入口同期漏れ](https://github.com/kosnu/savings/commit/17cd78a56d1ed8a8bc84f03fb48dc858658f51cc)     |
| semantic-roles       | 同じ形式を使う状態とイベント、担当範囲とユーザー上限などの意味の違い  | [上限とownershipの混同](https://github.com/kosnu/savings/commit/14cb0af0cedd1eada56cd478e6b6ef2312dbedf1)    |
| preserved-guarantees | 責務の撤廃・移動後に保証を担う層と、許可・拒否の両条件                | [Task分離撤廃後の実装権限](https://github.com/kosnu/savings/commit/fabe6638212f2829d80176626294282bbfadac0f) |

機械可読モデルは[change-coverage.json](contracts/change-coverage.json)。schema_version 1、
kind `aidd_change_coverage`、対象globの`paths`、IDと問いを持つ`axes`を所有する。
更新は今回のような具体的な漏れを根拠に行い、未観測の概念や組合せを無制限に登録しない。
対象はAIDDの契約・実装・入口・検証機構と間接入力。共有package/lockfileはファイル単位で
保守的に選ぶため、product依存だけの更新でも関連しない軸を理由付きで対象外にできる。
アプリソースだけの変更には要求しない。

## 判断の作成とレビュー

1. 変更する概念を説明する。例はDecision継続、検証routing、契約移行、scopeと実装権限。
2. 正本・機械契約・checker・CLI/adapter・入口・テストから、その概念に関係する具体的pathを列挙する。
   変更しないrepresentationも検討対象へ入れる。初期一覧外に関係が判明したら同じ概念へ追加する。
3. 各概念についてモデルの全軸を評価する。`scenario`には具体的な操作列・入力・経路を記述し、
   問いの転載だけで済ませない。execution-pathsでは表の各経路を照合し、対象外の理由も示す。
4. 変更するrepresentationはtarget_stateとownershipに登録する。削除対象はownershipを維持し、
   変更基準点に存在したpathをCoverageへ残して最終representationから外す。affectedなパターンを既存の
   verification caseへ接続する。正常経路と拒否条件を区別する。manual caseも実際の観察を必要とする。
5. 実装前にcheckpointへ固定する。reviewでは最終差分から概念・representation・実行パターンの
   列挙不足と判定の妥当性を照合し、追加・変更は新checkpointと全体再検証で扱う。

representationのstatusは、そのファイルを変更するかの判定。実際に変更した対象pathを
`unaffected`や`not-applicable`で閉じることはできない。パターンのstatusは挙動への影響を表す。
例えば文言修正はrepresentationがaffectedでも、操作順序への影響はunaffectedになり得る。
unaffectedは関連するが契約を維持する場合、not-applicableはその概念に該当しない場合に使う。
どちらも理由を残す。判定欄の記入自体を正しさの証明にしない。

## Decisionへの接続

`change_coverage`は概念ごとの配列。各要素は次を持つ。

- `id`: Task内で一意の安定ID。差分更新のkey。
- `concept`: 変更する仕組みの説明。
- `representations`: `path`、`status`、`reason`。概念内でpathは一意。affectedは所有するtarget representation、または変更基準点にある削除対象fileに一致させる。
- `patterns`: `axis`、`scenario`、`status`、`reason`、必要時の`verification_case_ids`。開始時モデルの各軸を1回ずつ記録する。
  affectedは検証caseを1件以上参照する。他の判定でも検証参照を持てる。

同じpathが複数概念に関わる場合は各概念で検討できる。変更した対象pathは少なくとも1概念で
affectedとして扱う。概念の数や分割をCoreが意味推論して生成することはない。
変更しない関連文書の検討登録はownershipや書込許可を増やさない。

初回は通常のDecisionへ記載し、改訂は`decision-update`の`change_coverage.upsert/remove`を使う。
省略時は保持する。scope_revisionのような一回限りのイベントではない。
表示は`task-status --field change_coverage`、開始時モデルは`--field change_coverage_model`。
モデルの問いを表示から参照し、全概念を毎回入力し直す必要はない。

## CoreとAgentの境界

Coreはモデルの形式、必須軸の欠落・重複、対象pathの検討漏れ、判定・理由・scenarioの存在、
affectedなrepresentationのownership、検証case参照を検査する。
checkpointでは所有するbaseline fileと予定representation、最終検証では実差分も照合する。
caseの実行とEvidenceへの結合、改訂後の旧証跡失効は既存の検証契約を使う。

概念の選択漏れ、未登録の関連path、scenarioが本当に全経路を覆うか、理由や検証内容の妥当性は
Agentのレビュー責務。Coreは文章の意味や再発防止の完全性を証明しない。
5軸は最小の検討モデルであり、全概念・全実行経路の自動発見器ではない。

## 固定と互換性

新Taskではモデルfileを必須とし、Task開始時Git treeとinventoryのhashに結合して復元する。
Decisionはcheckpointを通してEvidenceへ結合する。候補のモデル改訂、main統合、checker移行で
開始時モデルを置き換えない。モデル変更は後続Taskから適用し、現在のTaskは従来の必須軸を維持する。
候補モデル自体の形式も設定検査で検証する。

開始時にモデルがない旧v5/v6 Taskは新fieldを要求せず、履歴bytes/hashを維持して継続する。
そのTaskでは既存のmanual caseとDecisionのreasonで5軸を記録する。モデル導入のためにTaskを
作り直したり、開始時checkerを黙って差し替えたりしない。この導入Taskもこの手動経路で試行する。
モデルのあるTaskの新fieldを旧binaryへ渡すことはできない。配信先baseが未対応なら、既存の
[CI契約移行](aidd-checker-operations.md#非互換なchecker契約の移行)で受け入れる。
Codex/Claude、Development/Learnで同じ契約を使い、Goal・skill固有の別モデルを作らない。

## 検証

モデルとcheckerの変更は`aidd-checker-tests`で検証する。5件由来の対象path、欠落・不正参照の拒否、
影響なし・対象外の受入、v5/v6とDevelopment/Learnの継続・Ship/CI、旧Taskの互換、
開始時モデル固定、差分更新と旧Evidence失効を回帰対象にする。
モデルを追加しただけで意味的なレビューを省略したり、Learnの自動更新を開始したりしない。

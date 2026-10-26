---
title: Code Review Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - apps/web
  - apps/api
  - AGENTS.md
  - .github/skills/code-review
  - .github/instructions/code-review.instructions.md
  - .agents/skills
topics:
  - review
  - rule-graph
  - pull-request
  - verification
when_to_read:
  - 実装済みの差分をレビューするとき
  - 複数のルール、ポリシー、設計判断が同じ差分に適用されるとき
  - Copilot code reviewの確認範囲を決めるとき
---

# Code Review Policy

この文書は、レビュー時にどの正本文書を適用するかを定義します。個別の設計判断、ポリシー、ドメインルールの本文は各正本文書に置き、この文書へ複製しません。

## レビュー対象

- レビュー対象は実装済みの差分、変更ファイル、変更された呼び出し経路です。
- PR本文、PRタイトル、既存コメントに書かれた意図は、ルール適用や問題判定の根拠にしません。
- 作業ツリーの無関係な変更や、差分に含まれない既存コードは対象にしません。

## 文脈取得とレビュー権限

差分と変更ファイル一覧を起点に、必要な文脈を次の順序で取得します。

1. `AGENTS.md` の共通制約、本policy、`docs/harness/rule-map.json` を確認します。同じレビュー実行内で取得済みの同じ内容は再利用し、skillや別の入口から同じ文書へ戻っても読み直しません。HEADや対象内容が変わった場合は該当する情報を取り直します。
2. 全変更面から必須rule IDと依存closureを和集合し、選んだ正本の本文を取得します。下表の必須参照も含め、重複する文書は一度の取得で適用します。front matterは追加探索に使い、必須集合の代わりにしません。
3. 変更された呼び出し経路、呼び出し元・先、型、テスト、設定など、動作・回帰・安全性を判断するために必要な関連コードを取得します。差分にないコードも参照対象です。ファイル名やsymbolを手掛かりに検索し、不足する関係だけを追加取得します。

追加探索は、判断できない挙動・依存・同期先を明確にして対象を広げます。repository全体の目録、全docs、無関係な実装例を毎回集めません。固定のファイル数・文字数上限や、低priorityを理由に必要な参照を打ち切ることもしません。出力が切り詰められたら不足範囲を追加取得し、未読部分を確認済みにしません。

レビュー中はファイル編集、レビューコメントへの返信、threadのresolveを行いません。レビューだけの依頼は開発の実行委任ではなく、Task/Goalの新規作成、開発用の記録更新、Ship、Auditや改善を開始する権限を与えません。対象PRの既存Task・Intent・検証証拠の参照、必要な読み取り検査、下記のADR履歴検査は維持します。開発手順の文書は変更面や証拠の評価に必要な場合に読み、全レビューで実行手順を辿りません。

## レビューで確認する内容

適用された全正本について、意図した動作、既存パターンとの整合、回帰、境界条件、同期漏れ、検証不足を実差分と照合します。安全性、性能、アクセシビリティ、データ整合性も、変更対象に適用する正本に従って確認します。指摘を見つけても残りの確認を省略しません。

UIの変更では、現行ルールに適合する共通コンポーネント・同種画面の比較元を特定し、操作・エラー・再操作などの状態を実コードと照合します。差異がある場合は、要求や既存部品の機能不足から必要性を確認します。規則名の列挙、一般的な表現としての許容、機能テストの成功だけで、既存UIとの整合を確認済みにしてはいけません。比較元、差異の判断と根拠は既存のレビュー要約に含め、新しい工程や記録形式は作りません。

変更が生む状態の変化（ファイルの作成・更新・削除など）と、その状態を観測・判定する処理を特定します。直接の呼び出しやデータ読み取りの関係がなくても、状態を介した影響を確認対象に含めます。影響する操作を実際の利用順でつなぎ、正常に完了することと、不正な状態を拒否する境界を確認します。機能ごとの単独確認だけで、接続した操作経路の確認を済ませた扱いにしません。

データ形式・入出力契約を変更する場合は、生成側と利用側を特定し、変更後の形式を利用側へ渡す実際の経路を確認します。形式・フィールド名だけでなく、共通入力の文字種・長さ・必須／任意などの受理条件も照合し、境界値で両者の整合性を確認します。旧形式を維持する場合は、その互換性も確認します。片側だけの確認を、生成側と利用側の接続を確認した根拠にしません。

文書の例は、目的と本文が保証する範囲を確認して評価します。構造や使い方を説明する例に、実環境での完全性・そのままの実行可能性を一律に要求しません。対象に応じた値の選択・置換を本文が求めている場合は、その条件を含めて判断します。実行可能な手順として保証する例や、説明する仕組み自体を誤って伝える例は、保証内容や説明目的との不一致を具体的に示します。

CI workflow変更では、変更に関係する信頼境界・起動条件・移行期間を、[Secret保護・イベント起動・旧新並行稼働の事例](../../ai-driven-development/semantic-review-cases.md#ci-workflow変更)と照合します。事例の入力条件に応じて証拠を選び、実設定に依存する保護を変更・主張しない差分へ一律の実設定確認や承認段階を追加しません。

### テストの必要性と保証範囲

テストが成功することと、回帰検知のために残す必要があることを分けて判断します。追加・変更・削除するテストは、次を実コードと照合します。

- 自前の責務: Intentや正本が求める、呼び出し条件、値の受け渡し、制約、失敗時の扱いなど、リポジトリが維持する契約は何か。
- 検出する故障: その契約を壊した場合、どの入力・実行経路・観測結果で失敗するか。依存を直接呼ぶだけで、自前の接続を外しても成功するテストを連携の証拠にしない。
- 保証しない範囲: mockやfixtureで置き換えた境界、実行しない処理、観測しない副作用は何か。

自前の契約違反を検出するテストは維持します。必要な故障を検出できない、または名前・説明が観測範囲を超える場合は、経路・assertion・主張を変更します。依存の標準動作だけの再確認、自前の契約に結び付かない設定値の復唱、同じ故障を同じ境界で十分検出するテストとの重複は、必要な回帰検知が残ることを確認して削除します。対象外にも不要テストがあるとは推定しません。

外部パッケージの利用、mock、設定値の検査という形式だけで不要と判定しません。たとえば自前の設定生成を通して依存への引数や呼び出し条件を検査すれば、接続の欠落や誤った設定を検出できます。ただしmockへの引数一致は、依存内部の処理や外部サービスの成功を保証しません。

workflow本文の参照元・条件・順序の検査は、自前の接続や制約の静的な回帰検知として扱います。YAML解釈、承認機能、実際のstep実行まで確認したとは説明しません。CLIとshellをつないでも外部APIをfakeにした場合は、そのfakeへの要求までが観測範囲です。

テスト名、コメント、検証結果の説明は、実際に通った経路と観測した結果に合わせます。判断理由は既存のレビュー・PR・会話の必要な要約に含め、新しい台帳や必須記録項目を設けません。Webの適用例は[Web Test Policy](../../../apps/web/docs/policies/test-policy.md#必要性と保証範囲の適用例)を参照します。

### 実装・説明・検証証拠の整合

実装や採用判断を変更した場合、最終差分と現在の呼出経路を起点に、現在適用する説明と検証証拠の内容を照合します。PR本文や工程結果に書かれた説明・成功の主張も照合対象であり、それ自体を実装の根拠にしません。

- 現在の方式・入力・結果・失敗時の挙動を実装から確認し、説明の主張と対応付けます。廃止した方式や置換前の判断を現在の説明に残していないか、変更で無効になった前提を確認します。
- 成功を示す証拠は、変更後の対象内容・modeに対して実際に終了した検証であり、現在存在するテスト・検査経路と、その確認内容が主張を支える場合だけ採用します。コマンド名や終了コードだけで、削除・改名・確認内容の変更後も同じ挙動を検証したと判断しません。削除済みテストや廃止方式での成功は当時の証拠であり、現在の成功には使いません。
- 形式・鮮度の検査に合格しても、説明または成功の主張が実装・確認内容と矛盾すれば**fail**です。内容を確認できない証拠は**unknown**とし、矛盾を観測した場合と分けます。実施済み・未実施・失敗・未確認と、各検証が保証する範囲を区別し、構造テストの成功から実環境の動作確認まで済んだと広げません。
- 不整合は委任範囲内の現在の説明と、[Coreの記録契約](../../ai-driven-development/aidd-checker.md#記録)で更新できる進行中の同じサイクル・同じ工程の結果に反映します。古い成功を解除し、変更後に必要な検証・レビューを行います。終了したTask・過去サイクルなど保持対象の記録は変更せず、現在の証拠から除外します。過去の記述が現在と異なることだけを不適合にしません。

根拠は既存のレビュー要約へ、主張・実装と検証の観測・判定・未確認範囲を短く残します。新しい履歴・証拠管理機構や承認段階は設けません。[適用事例](../../ai-driven-development/semantic-review-cases.md#実装変更後の説明と検証証拠)で、内容の不整合と証拠不足を区別します。

## 適用範囲

1つの差分には複数の変更面が同時に含まれます。変更面を1つに絞ったり、priorityの高いルールだけを残したりせず、該当する正本ノードをすべて和集合します。

選択したノードの `depends_on` は必ず読みます。`related` は通常のrule-map上では任意参照ですが、下表でレビュー必須として示したノードは必ず読みます。

指摘を1件見つけてもレビューを終了せず、適用された全ノードの確認を完了します。ルール間に解消できない矛盾がある場合は、推測で判定せず矛盾と確認事項を報告します。

## Webのレビュー必須ルーティング

| 変更面                   | 変更の兆候                                                                                                | レビューで必ず確認するrule ID                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| コンポーネント           | `apps/web/src/components/**` または `apps/web/src/features/**` のコンポーネント追加、移動、抽出、責務分離 | `web.component-structure`                                |
| Feature配置              | `apps/web/src/features/**` の新規配置、移動、feature境界変更                                              | `web.feature-directory`                                  |
| UI                       | WebのJSX/TSX、style、layout、form、dialog、responsive、variant、size、colorの変更                         | `web.design-system-brand`, `web.design-rules`            |
| ドメインUI               | featureまたはrouteで金額、日付、月、分類、状態、基準値を表示・入力・更新                                  | `web.domain-ui-rules` と該当する `domain.*`              |
| Query / mutation / cache | `useQuery`、`useMutation`、query key、invalidation、refetch、`QueryClient`、API更新後の反映の変更         | `web.query-cache`                                        |
| 非同期状態               | loading、error、retry、Error Boundary、非同期取得境界の変更                                               | `web.suspense-boundaries`                                |
| Story                    | `*.stories.tsx` の追加・変更、またはStory作成条件に該当するコンポーネント追加                             | `web.component-structure`, `web.storybook-browser-tests` |
| 回帰テスト               | ユーザーに残る表示、入力、保存、取得、状態遷移の追加・変更                                                | `web.test-policy`                                        |

ドメイン値が金額または日付に該当する場合は、`domain.amount` または `domain.date` と、それらを依存関係から追加する選択ノードを確認します。Storyはbrowser testの実行対象であることを意味しません。`web.storybook-browser-tests` を読み、収集範囲、tag、provider、MSWの要否を判定します。

## APIのレビュー必須ルーティング

APIの正本は、Supabase/Auth/Databaseの構成を扱う `docs/infrastructure.md`、実行境界を扱う `docs/harness/policies/transaction-boundaries.md`、期間と履歴を扱う `docs/harness/policies/temporal-data.md`、および対象domainの文書です。`apps/api/README.md` は操作手順とディレクトリ構成の案内として使い、ルール本文の代わりにはしません。

| 変更面                  | 変更の兆候                                                                                | rule-map activity       | レビューで必ず確認するrule ID                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DB schema / migration   | `apps/api/supabase/migrations/**` のtable、column、constraint、index、triggerの追加・変更 | `review_api_schema`     | `infrastructure.overview`, `policy.transaction-boundaries`, `policy.query-performance`、該当する `domain.*`                         |
| RPC / database function | `CREATE FUNCTION`、RPC、DB function、複数更新をまとめる処理の追加・変更                   | `review_api_rpc`        | `infrastructure.overview`, `policy.transaction-boundaries`, `policy.query-performance`、該当する `domain.*`                         |
| RLS / Auth / ownership  | RLS policy、Auth設定、認証済みユーザー確認、`user_id`やownership境界の追加・変更          | `review_api_auth`       | `infrastructure.overview`, `policy.transaction-boundaries`, `domain.user`                                                           |
| 期間・履歴・月次状態    | `current_date`、`now()`、有効期間、履歴、月次状態、削除・無効化の扱いの追加・変更         | `review_api_temporal`   | `infrastructure.overview`, `policy.temporal-data`, `domain.date`、該当する `domain.*`                                               |
| API domain              | 金額、日付、支払い、カテゴリ、予算、Book、ユーザーのschema・RPC・seedの追加・変更         | 対象domainの `review_*` | 該当する `domain.amount`、`domain.date`、`domain.payment`、`domain.category`、`domain.monthly-budget`、`domain.book`、`domain.user` |
| API config / seed       | `apps/api/supabase/config.toml` または `apps/api/supabase/seed/**` の追加・変更           | `review_infrastructure` | `infrastructure.overview` と該当する `domain.*`                                                                                     |

期間・履歴・月次状態に該当するDB変更では、通常のschema、RPC、Authの確認に加えて `policy.temporal-data` を必ず確認します。RLSやAuthに該当する差分では、認証・ownershipの境界とtransactionの責務を分けて確認します。

Web/APIの表に該当しない差分も、`docs/harness/rule-map.json` のpath/surface直接一致と`depends_on` closureを必須集合にします。`domains`、`activities`、`topics`、front matterは追加の意味的な適用判断に必要な文書を探すmetadataであり、hard routingの必須集合を減らす条件にはしません。`apps/api/**` の差分で変更面を分類できない場合は、汎用マッチングだけで完了扱いにせず、未定義のAPIレビュー面として報告します。

採択済みADRを含む差分では`documentation.policy`を必ず適用し、PRのbase branchに対応するorigin remote-tracking branchを`--base-ref`に指定して`docs/harness/scripts/validate_accepted_adrs.py`を実行します。validatorが拒否した既存履歴の変更や文書の削除・移動は、末尾の日付付きClarificationまたは新しいADRへ置き換わるまで解決済みとしてはいけません。
ADRの変更・参照では、当時の判断を現行ルールとして強制せず、現在有効な条件が責務ある正本に反映され、対象pathから選択されるか確認します。新しい判断や置換がある場合は、ADR間の履歴上の関係と正本への反映を別々に確認します。

## Skillのレビュー

skillの用途や実行modeを追加・変更した場合は、[Documentation Policy](documentation-policy.md#agent向け定義)に従い、
ユーザーの依頼からdescriptionによる選択、本文の処理・権限・完了条件までを通して照合する。
本文だけを読んで条件が揃っていることや、front matterの形式検証だけを成功の根拠にしない。

変更したmodeを使う代表的な依頼と、隣接する非発火の依頼を用い、次を確認する。

- 依頼と既存の承認対象から、descriptionで対象skillを選択でき、必要な本文の分岐へ到達する。
- 本文で扱う新しいmodeがdescriptionから抜けておらず、descriptionが本文の権限を広げていない。
- 分析・説明のみ、未承認の実行、承認範囲を越える依頼を、実行権限へ読み替えない。

たとえば承認済みAuditコメント対応は、改善案がない場合も選択から返信・解決の分岐へ到達する必要がある。
Audit依頼のみでは分析を行い、承認がない返信・解決は実行しない。照合に用いた依頼、選択先、
本文で許可される処理と許可されない処理をレビューの根拠に残す。

## AIDD v4のレビュー

実差分とTaskの担当範囲を基に、rule-mapのpath一致・surface必須rule・depends_on closureを確認する。
一般docsやGitHub設定を一律にaidd-harnessへ分類せず、それぞれの直接一致規則も省略しない。
Go Coreの選択結果に、意味的な変更面から必要な規則を追加する。

[Workflow](../../ai-driven-development/workflow.md)と[Core](../../ai-driven-development/aidd-checker.md)を適用する。
意味評価は[Workflowの評価の責務](../../ai-driven-development/workflow.md#評価の責務)に従い、元のIntent・有効な実行権限・最新依頼と実際の成果を照合する。
agentが追加した仕様と検証条件の一致だけで合格にせず、目的から導く期待結果と実際の出力・副作用・差分の対応、追加判断の必要性と権限の根拠を確認する。
Intentの各完了条件のreviewには、その照合結果とpass/fail/unknown、差がある場合の次の行動を根拠として残す。失敗時の挙動や未確認事項も含める。
Coreの合格は意味評価の代替ではなく、reviewの宣言は実行証拠の代替ではない。
Taskを跨ぐ差分混入、古い検証、stageとの内容・mode不一致、未承認の改善を成功扱いしない。

Coreは専用worktreeと単一writerを前提とする。並行writerやGitメタデータ改ざんを
前提に不要な防御を要求せず、正常な操作経路で再現する契約違反を示す。
checkerの変更では境界テスト、実際の呼出経路、entrypoint、CIの同期を確認する。

## レビュー結果

レビュー結果には、PR概要ではなくレビュー結果のサマリとして、次を記録します。

```text
## Coverage
- Checked rules: <確認したrule ID>
- Unresolved: <未解決の矛盾またはなし>
```

その後に、重要度順で各findingの重要度、ファイルと行番号、問題、影響、根拠、修正案を報告します。findingがない場合も、確認した範囲と残っている検証不足を記録します。

プロセスの実況は含めず、根拠のあるfindingと未確認事項に絞ります。

この要約は既存のIssue・PR・会話で報告します。開発の実行委任内では[Coreの記録契約](../../ai-driven-development/aidd-checker.md#記録)に従い、レビューの前後に同じサイクルのレビュー結果を更新します。読み取り専用のレビュー依頼から記録の書き込み権限を作りません。操作履歴・コマンド生出力は保存しません。

## レビュー担当の扱い

この方針は、複数のレビュー担当者を割り当てたり、独自のリスク分類で確認範囲を削減したりしません。確認範囲は差分とこの文書、`rule-map.json`、選択された正本文書で決まります。

レビュー担当や観点の分担は、`AGENTS.md`のサブエージェント利用方針に従い、作業の性質と分担の効果から判断します。通常のレビュー、再利用確認、テスト実行・結果確認、軽微な修正の確認も委譲の対象にできます。担当を分ける場合も、適用規則と確認範囲を維持し、メインagentが結果を統合して未確認事項と完了を判断します。

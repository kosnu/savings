---
title: AI Driven Development Workflow
doc_type: guide
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - workflow
  - prd
  - design-doc
  - pull-request
when_to_read:
  - AI駆動開発の工程と成果物境界を判断するとき
  - Codex Goalの遷移、完了条件、停止条件を確認するとき
---

# AI Driven Development Workflow

このリポジトリのAIDDは、次の4工程を順に実行します。

1. Intent / Requirements
2. Design / Plan
3. Build / Verify
4. Ship

新しいサイクルは必ずIntent / Requirementsから始めます。後続工程へ進めるのは、直前のGoalが完了し、その工程の成果物と検証証拠が揃った場合だけです。ファイルの存在、テストの成功、Goal案の作成だけでは工程完了になりません。

## サイクルとGoalの状態

同時に扱うGoalは1件です。開始前に現在のGoalを確認します。

- 同じサイクルの未完了Goalがあれば、そのGoalを続行する。
- 別タスクの未完了Goalがあれば、置き換えず停止する。
- pausedはユーザーまたはシステムが所有する状態とし、agentは再開操作を推測しない。
- objective、Done、Verificationを満たしたときだけ`complete`にする。
- 進展可能な間はactiveを維持する。同じ阻害条件が3回以上連続し、安全な代替経路もない場合だけ`blocked`にする。
- 終端更新後は状態を再取得して確認してから次工程へ進む。

## Task Contextとworkspace

RequirementsのTask Context正本は、サイクル開始時に取得した最新Issue本文だけです。会話、レビューコメント、現在のdiff、前回成果物、変更直後のルールはRequirementsを追加しません。前回成果物は欠落検出用baselineとしてのみ利用します。

Issueごとにworkspaceは1件です。既存が1件ならその名前をtask identityとして再利用し、複数なら停止します。0件ならworkspace validatorがサイクル開始時の最新Issue titleをNFKC正規化・casefoldし、ASCII英数字列を最大48文字のkebabへ変換した表示部分（空なら`issue`）と、正規化titleのSHA-256先頭12桁から`<Issue番号>-<表示部分>-<title hash>`を一意に導出します。呼び出し側は別名を考案せずvalidatorの出力を使います。

cycle-start Issue titleはRequirementsだけが`validation.cycle_start_issue_title`として所有します。Requirements Goalとartifactは取得したtitleとの完全一致を検証します。Designは検証済みcanonical RequirementsのpathとSHA-256をcycle identityとして参照し、titleを再入力・再記述しません。Design completion receiptはRequirements bytesからtitleを導出して固定し、BuildとShipはそのreceiptと上流hashをidentityにします。後工程がtitle引数を受け取る経路は持ちません。

## Rule coverage

rule-mapの選択は、priorityの高いノードや主要な変更面だけへ狭めず、各工程が所有する根拠から該当するdirect nodeをすべて和集合し、その`depends_on` closureを加えた最小の完全なsubgraphにします。全ドキュメントを読むことを完全性の代わりにしてはいけません。

- Requirementsは、Issue本文にliteral evidenceがあるpath、domain、activity、topicだけからdirect nodeを選びます。後工程の技術的変更面をIssueへ追記したり、Issueにない語をRequirements evidenceとして扱ったりしません。
- Designは、`rule-map.json`の`review_routing.surfaces`から実装予定面を`rule_coverage.implementation_surfaces`へ固定します。予定pathに`applies_to.paths`が一致する固有nodeなど、surfaceから自動選択されないruleは`additional_rules`へ記録します。surfaceの必須rule、Requirements選択、Designで判明した`additional_rules`の和集合と依存closureをvalidatorが最終selected ruleとして計算し、Design Goalとartifactの一致を検証します。
- Design completion receiptは、最終selected rule文書、Designのimplementation surfaces、Build開始前のGit `HEAD`を固定します。
- Build / Verifyは、receiptのGit基準点から得た実際の変更pathを`review_routing`で自動分類し、各pathに一致するrule nodeの`applies_to.paths`もdirect ruleとして和集合します。実差分に未宣言surface、receiptにないsurface必須rule・path一致rule・依存node、またはsurface未定義のgoverned pathがあれば失敗し、成功時だけpathごとの選択根拠を持つcanonical Build Coverage recordを生成します。

DesignはRequirementsのliteral rule selectionを変更せず、自工程が所有する構造化coverageとして必要なruleを追加できます。Build / Verifyで実差分がDesign coverageを超えた場合は後工程で黙って補完せず、Design coverage不足としてStopします。

## 成果物モデル

`requirements.json`と`design-doc.json`が機械判定の正本です。`requirements.md`と`design-doc.md`はJSONから決定的に生成する表示であり、通常validatorは解析しません。

構造上の意味は次で表します。

- requirement、section、block、contractの安定ID
- transitionのstatus
- evidenceの`role`と`owner_id`
- Requirementsが所有するcycle-start Issue titleと、artifact、Issue、baselineのSHA-256
- gate内の参照関係と完全なinventory
- Designが所有する根拠付きproduct behavior inventoryとDesign completion receipt

ID、owner、role、reference、hash、inventoryが成果物の主要な機械構造です。現行schema v2はこれに加えて、canonical heading、非placeholderの実質的な説明、Issueに実在して対象recordへ一意に対応するevidenceをartifact format gateとして検証します。これらの表示・証拠条件だけで工程完了とは判断せず、Goalのobjective、Done、Verificationも満たす必要があります。

## 工程契約

### Intent / Requirements

- 入力: 最新Issue snapshot、canonical rule map、Issue本文にliteral evidenceがあるdirect nodeと依存closure、Git `HEAD`の同一workspace Requirements baseline。
- Cycle identity: 取得したcycle-start Issue titleを型付きfieldとして唯一所有し、Goalとartifactの両方で同じ値を検証する。
- 所有: canonical `requirements.json`と生成`requirements.md`。
- 完了: Issue全体を表す全Requirement IDと必須sectionが定義され、baselineの全recordが`unchanged`、`changed`、`new`、`retired`のいずれかで説明され、provenance、literal rule selection、continuity、render同期が成功している。
- 停止: Issueまたはworkspaceが曖昧、Issue snapshotが工程中に変化、Issue evidenceからrule dependencyが解けない、完全な要求scopeを決められない、gateを満たせない。

### Design / Plan

- 入力: 検証済みcanonical Requirements全体とそのpath・SHA-256、選択ルール、実装文脈、Git `HEAD`の同一workspace Design baseline。Requirementsはread-onlyで、cycle titleはRequirementsからのみ導出する。
- Product behavior: 追加・変更・削除するユーザー操作と状態遷移は`product_behaviors`のtyped inventoryだけで定義する。各recordは`PB-*` ID、種別、change、canonical `requirement_id`だけを持つ。Requirement本文は検証済み`requirements.json`だけが所有する。genericなsource kindや挙動本文の複製は置かない。選択済みruleはRequirementsとDesignを制約するが、不足するRequirement bindingの代替にはしない。同じRequirement IDをownerとするちょうど1件のdesign evidenceがそのrecordを所有する。Design proseはrecordを参照・説明できるが、新しいproduct behaviorの定義場所にはならない。
- Rule coverage: `rule_coverage.implementation_surfaces`と、surfaceから自動選択できないDesign固有の`additional_rules`をDesign Goalとartifactが同じ値で所有する。validatorがRequirements選択、surface必須rule、additional rule、依存closureから最終selected ruleを計算する。
- 所有: canonical `design-doc.json`、生成`design-doc.md`、同じbyte snapshotから完全再検証したretained Design Goal・両成果物・Issue snapshot・canonical rule map・最終selected rule文書・implementation surfaces・Build基準Git `HEAD`を固定するcanonical Design completion receipt。
- 完了: 全Requirement IDがdesign evidenceとverification evidenceを所有し、全baseline sectionがhashにより`preserved`または`replaced`へ分類され、product behavior inventoryのRequirement bindingとowner、rule coverageが検証され、同じbyte snapshotに対するcoverageとrender同期の成功後にDesign completion receiptとそのSHA-256が固定されている。
- 停止: Requirements再検証失敗、要求ごとの実装または検証方針を決められない、ユーザー操作または状態遷移を所有するRequirement IDがない、実装予定面をmachine review surfaceへ分類できない、baseline transitionが不完全、Design gateを満たせない。

### Build / Verify

- 入力: 直前のDesign Goal完了証拠に記録されたDesign completion receiptとそのSHA-256。Build entry gateは記録SHA-256に一致するreceipt bytesを読み、その後はそのbytesをreceipt identityとして扱う。現在のIssue snapshot、canonical Requirements / Design、両生成Markdown、canonical rule map、選択済みrule文書、Git `HEAD` Requirements / Design baselineを1回だけ読み込んだ同一byte snapshotから再検証し、そのsnapshotの全pathとhashがreceiptに完全一致し、最終drift checkで再読込した各入力も同じ場合だけ成功する。cycle titleはRequirements bytesとreceiptからのみ得て、Build入力として受け取らない。pathの継続占有ではなく検証済みsnapshot bytesがidentityであり、上流成果物とreceiptはread-only。
- 所有: 必要な実装、テスト、fixture、runtime設定と、canonical `.aidd/build-rule-coverage.json`を含む検証証拠。
- 完了: 全RequirementとDesign方針を実装し、対象appの必須verificationが成功し、receipt基準の実差分についてsurface必須ruleとpath一致ruleの依存closureを記録したBuild rule coverageに未解決がなく、Build entry gateを同じreceipt SHA-256に対して再実行して、上流成果物が不変である。
- 停止: Build entryのartifact gateまたはrender同期が失敗、上流成果物の不足・矛盾を解釈で埋める必要がある、typed inventoryにないproduct behaviorが必要、実差分に未宣言surface・receiptにないsurface必須rule・path一致rule・依存node・未分類governed pathがある、許可範囲を越える変更が必要、外部権限なしでは検証不能。

### Ship

- 入力: Build / Verify完了済みdiff、検証結果、Issue、branch、必要なPRまたはreview context。
- 所有: commit、push、PR、説明、許可されたreview replyとthread状態確認。
- 完了: 要求されたdelivery操作が完了し、直前にGit、CI、PR、thread状態を再確認している。commitまたはlocal testだけをShip完了としない。
- 停止: delivery先や公開権限が曖昧、Build証拠が現在diffと一致しない、公開前に実装変更が必要、必須CIまたはreview状態が未確定。

## Goal contract ID

RequirementsとDesignの一時Goal JSONは、次のentryを表の順序とtextで持ちます。task固有entryは必須entryの後に追加します。

| Goal | Field | ID | Canonical text |
| --- | --- | --- | --- |
| Requirements | constraints | `task-context` | 最新Issue本文だけをTask Context正本として扱う。 |
| Requirements | constraints | `phase-boundary` | Requirements Goal内では実装しない。 |
| Requirements | stop | `validation-failure` | workspaceまたはRequirements Gateの検証が失敗した場合は停止する。 |
| Requirements | stop | `scope-ambiguity` | Issue本文から要求scopeを一意に決められない場合は停止する。 |
| Requirements | done | `complete-scope` | 最新Issue全体を覆うRequirementsと全要求IDを定義する。 |
| Requirements | done | `validated-artifact` | Requirements Gateと生成成果物の同期検証を成功させる。 |
| Design | constraints | `canonical-input` | 検証済みのcanonical requirements.jsonをread-only入力として扱う。 |
| Design | constraints | `phase-boundary` | Design Goal内では実装しない。 |
| Design | stop | `validation-failure` | Requirements再検証またはDesign Coverage Gateが失敗した場合は停止する。 |
| Design | stop | `scope-ambiguity` | 要求ごとの設計・検証scopeを一意に決められない場合は停止する。 |
| Design | done | `complete-scope` | 全Requirements IDとbaseline sectionのDesign coverageを定義する。 |
| Design | done | `validated-artifact` | Design Coverage Gateと生成成果物の同期検証後にcompletion receiptを固定する。 |

## Learn

Learnは工程Goalではありません。Ship完了後、または上流成果物の不足・矛盾でGoalが`blocked`になった後に、ユーザーが明示的に実行します。findingは、Issue本文の変更案、rule/policyの追加・変更、または既存rule/policyのsharp化へ分類します。Issue変更案は実際にIssueへ適用されるまで次サイクルのTask Contextではありません。

---
title: Intent / Requirements Goal Template
doc_type: template
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - requirements
  - prd
  - temporal-data
when_to_read:
  - Requirements / PRD相当の要求整理を作成するとき
  - AIに目的、制約、成功条件を整理させるとき
---

# Intent / Requirements Goal

````md
# Intent / Requirements Goal

## Goal

背景・ありたい姿・既存コード・既存ドキュメントをもとに、実装前にRequirements / PRD相当の要求整理を作成する。

## Inputs

- Task Context正本: サイクル開始時に取得した最新Issue本文だけ
- Issue: `owner/repo#number`
- Issue URL:
- Issue updatedAt:
- Issue本文SHA-256:
- Workspace: `<Issue番号>-<短いtitle>`。同じIssueの既存workspaceがあれば必ず同じ名前を使う
- Workspace identity検証結果:
- 既存Requirements / PRD: 履歴参照のみ。Task Contextへ追加しない
- Goal source: temporary `requirements_goal` JSON。このJSONを検証してから`display.markdown`をGoal objectiveに使う。
- 出力先: 同じworkspaceのcanonical `requirements.json`。このGoalが書き込みを所有し、`requirements.md`を生成する。

## Oversight Inputs

- なぜ今これをやりたいか:
- どのユーザー体験を改善したいか:
- 成功したと言える状態:
- ユーザーが判断したいこと:
- 守りたい制約:
- まだ決めていないこと:

Oversight Inputsが意図、scope、制約、成功条件を変える場合は、先にIssue本文を更新して再取得する。会話上の補足だけでRequirements入力を増やさない。

## Scope

- 対象:
- 関連Issue / チケット:
- 対象ユーザー:
- 対象機能:
- 対象外:

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- 作業分類:
  - path:
  - domain:
  - activity:
  - topic:
- Direct nodes: `id` -> `file`: Issue本文の根拠 / 根拠内に同じ文字列で存在する`applies_to`の一致fieldと値 / reason
- Depends-on nodes: `id` -> `file`: direct nodeからの推移的閉包を満たす、選択済みdirectまたはdependency nodeからのedge / reason
- Conflict decision: none / overrides / priority

実装、test、fixture、mock、app固有のpolicyは、Issue本文がそのsurfaceを明示している場合を除き、Design / PlanまたはBuild / Verifyで選ぶ。実装policyからプロダクト要求、受け入れ条件、Q&A判断を新設しない。

## Requirements Input Gate

以下のobjectをtemporary `requirements_goal` JSONの`validation.input_gate`へ含め、生成する`requirements.json`にも同じobjectを記録する。Goal Markdownと生成Markdownは機械検証入力にしない。`direct_rules`はIssue本文から選んだnodeを少なくとも1件含め、空配列を許可しない。`issue_evidence`はIssue本文の原文抜粋、`match`はrule-map nodeの`applies_to`と一致させ、その値を正規化後の`issue_evidence`内に同じ文字列で含める。`depends_on`はdirect nodeからの推移的閉包をすべて記録する。

```json
{
  "task_context": {
    "source": "issue_body",
    "issue": "owner/repo#123",
    "url": "https://github.com/owner/repo/issues/123",
    "updated_at": "2026-01-01T00:00:00Z",
    "body_sha256": "64文字のSHA-256"
  },
  "direct_rules": [
    {
      "id": "domain.user",
      "issue_evidence": "userの言語設定を保存する",
      "match": { "field": "domains", "value": "user" },
      "reason": "Issueの対象domainに適用するため"
    }
  ],
  "depends_on": []
}
```

## Requirements Completeness Gate

新サイクルでは、最新Issue全体を満たすRequirements / PRDの完成版を作る。今回追加・変更された内容は差分であり、Goalまたは成果物のscopeではない。baselineは呼び出し側で選ばず、validatorが`--workspace`に対応するcanonical `requirements.json`をGit `HEAD`から取得する。前回の全要求項目と必須section、新しい全要求項目について状態遷移を記録する。各必須sectionは`validation.sections`の別entryへ一対一で記録する。`changed`と`new`には最新Issue本文の原文根拠が必要であり、その原文を対象requirementまたはcanonical sectionのcontent内に含め、同種の別targetへ再利用しない。廃止根拠は対象IDと明示的な廃止表現を含み、廃止を否定する文であってはならない。

```json
{
  "issue_body_sha256": "64文字のSHA-256",
  "workspace": "123-example",
  "baseline": {
    "source": "git_head",
    "body_sha256": "64文字のSHA-256"
  },
  "requirements": [
    {"id": "FR-1", "status": "unchanged", "issue_evidence": null},
    {"id": "AC-1", "status": "unchanged", "issue_evidence": null},
    {"id": "AC-2", "status": "new", "issue_evidence": "Issue本文の原文"}
  ],
  "sections": [
    {"id": "background", "status": "unchanged", "issue_evidence": null},
    {"id": "users", "status": "unchanged", "issue_evidence": null},
    {"id": "stories", "status": "unchanged", "issue_evidence": null},
    {"id": "scope", "status": "unchanged", "issue_evidence": null},
    {"id": "functional", "status": "changed", "issue_evidence": "Issue本文の原文"},
    {"id": "non_functional", "status": "unchanged", "issue_evidence": null},
    {"id": "acceptance", "status": "changed", "issue_evidence": "Issue本文の原文"},
    {"id": "qa", "status": "unchanged", "issue_evidence": null},
    {"id": "technical", "status": "unchanged", "issue_evidence": null}
  ],
  "retired": []
}
```

Git `HEAD`に前回成果物がない初回サイクルでは、baselineの`source`を`none`、`body_sha256`を`null`にする。この判定とbaseline内の全要求項目・必須section inventoryの導出はvalidatorが行い、呼び出し側の一覧を信頼しない。Goal JSONと生成する`requirements.json`へ同じGateを記録し、成果物検証では両Requirements Gate objectを保持したGoal JSONと完全一致させる。前回成果物はTask Contextではなく、欠落検出だけに使う。

## Requirement Scope

Goal JSONの`validation.requirements`に、Gateの`requirements`配列と完全一致する全IDをcanonical順で実質的な定義として記載する。今回の差分だけを列挙しない。

- FR-1: Goalが扱う要求の要約
- AC-1: Goalが扱う受け入れ条件の要約
- AC-2: Goalが扱う新しい受け入れ条件の要約

## Requirement Provenance

| 判断 | 根拠 | 種別 |
| --- | --- | --- |
| Scope / FR / NFR / AC / Q&Aの各判断 | Issue本文のsectionまたは選択したproduct/domain rule | Issue / rule |

機能要件、非機能要件、受け入れ条件には、それぞれ一意な`FR-*`、`NFR-*`、`AC-*`識別子を付ける。次のDesign / Plan Goalはこの全識別子をscopeとしてcoverageを検証するため、識別子のない要求を残さない。

## Domain Value Intent

UIに表示、入力、比較、集計、状態化するドメイン値がある場合、`docs/harness/rule-map.json` で選択した domain / Web UI ルールに沿って、値ごとの利用目的をRequirements / PRDに整理する。

- 対象のドメイン値:
- 利用目的:
  - 実値を知りたい
  - 比較したい
  - 残量や到達可否を知りたい
  - 制約に違反していないか知りたい
  - 内訳を確認したい
  - 対象を識別したい
- 値そのものを見せたいのか、判断結果を見せたいのか:
- 比較元、基準値、許可範囲、分類、期間を添える必要があるか:

## Autonomy

- AIは既存コード、既存ドキュメント、関連Issueを調査してよい
- AIは曖昧な点を質問してよい
- AIはRequirements / PRDドラフトを作成してよい
- AIは提示された実装案をそのまま前提にせず、目的と制約から整理してよい
- AIはStop条件に当たらない限り、次のDesign / Plan Goalへ進むための入力を整理してよい
- AIはこのGoal内では実装してはいけない

## Done

- [ ] 背景と課題が説明されている
- [ ] 対象ユーザーと利用シーンが明確
- [ ] ユーザーストーリーがある
- [ ] スコープ内 / 外が明確
- [ ] Requirements Goalと成果物が最新Issue全体をscopeとし、今回追加・変更された内容だけへ狭まっていない
- [ ] 機能要件が検証可能な形で書かれている
- [ ] すべての機能要件、非機能要件、受け入れ条件に一意な`FR-*`、`NFR-*`、`AC-*`識別子がある
- [ ] UIにドメイン値が出る場合、値ごとの利用目的が整理されている
- [ ] UI文言やエラー表示が関わる場合、ユーザーが状態や失敗理由を理解できることが必要か整理されている
- [ ] error、empty、権限不足などの状態でユーザー向け操作が必要な場合、その操作が機能要件または受け入れ条件として明示されている
- [ ] 状態や失敗理由の表示だけを要求する場合、Design / Planで復帰操作を追加できる要求として扱っていない
- [ ] 有効期間、履歴、月次状態、削除が関わる場合、`docs/harness/policies/temporal-data.md` に沿って基準日と過去/現在/未来の具体例がある
- [ ] 非機能要件・制約が必要に応じて書かれている
- [ ] 受け入れ条件がテスト可能
- [ ] Q&Aログに判断と理由が残っている
- [ ] 技術的考慮事項が参考情報として整理されている
- [ ] Issue本文から読み取れる意図・制約・対象外を超えて解釈を広げていない
- [ ] Task ContextがIssue本文だけで、Issue番号、URL、updatedAt、本文SHA-256が記録されている
- [ ] Workspace identity validatorが成功し、同じIssueの別workspaceやversion/retry派生directoryを作っていない
- [ ] direct nodeごとにIssue本文の根拠、根拠内に存在する`applies_to`一致fieldと値、選択理由がある
- [ ] `direct_rules`が少なくとも1件あり、空配列でrule-map選択を回避していない
- [ ] direct nodeからの推移的dependency閉包がすべてあり、各非direct nodeが選択済み`via`からのrule-map edgeで接続されている
- [ ] プロダクト要求、受け入れ条件、Q&A判断がIssue本文または選択したproduct/domain ruleへ追跡できる
- [ ] 実装、test、fixture、mock、app policyからプロダクト要求を新設していない
- [ ] 会話、review、現在diff、前回artifact、直前に更新されたruleをTask Contextへ追加していない
- [ ] 成果物が同じworkspaceのcanonical `requirements.json`にあり、rendererで`requirements.md`とのbyte一致を確認している
- [ ] 成果物にIssue番号、URL、updatedAt、本文SHA-256が記録されている
- [ ] 成果物のRequirements Input Gateが同じIssue本文に対するvalidatorを通る
- [ ] 成果物のRequirements Input GateとRequirements Completeness Gateが、保持したGoalの対応するparsed Gate objectと完全一致する
- [ ] 成果物のRequirements Completeness GateがGit `HEAD`のcanonical baselineと最新Issueに対するvalidatorを通り、根拠なしに前回要求項目または主要sectionを欠落・変更させていない
- [ ] 前回と現在の背景、対象ユーザー、ユーザーストーリー、スコープ、機能要件、非機能要件、受け入れ条件、Q&A、技術的考慮事項が状態遷移として追跡されている
- [ ] 各必須sectionがJSONの別entryへ一対一で対応し、1つのentryを複数sectionへ使っていない
- [ ] `docs/harness/rule-map.json` で選択した関連ドキュメントとの整合性が確認されている
- [ ] Requirements / PRDが、選択したルール・ポリシーに違反していないことを確認している

## Verification

- 必ず実行:
  - `python3 .agents/skills/aidd-cycle/scripts/validate_workspace.py --repo-root <repo-root> --issue <owner/repo#number> --workspace <workspace>`
  - `python3 .agents/skills/aidd-cycle/scripts/validate_requirements_goal.py --issue <owner/repo#number> --issue-url <canonical-issue-url> --issue-updated-at <updatedAt> --issue-body <issue-body-file> --document <requirements-file> --rule-map docs/harness/rule-map.json --repo-root <repo-root> --kind artifact --goal-document <goal-file>`
  - `python3 .agents/skills/aidd-cycle/scripts/validate_requirements_continuity.py --issue <owner/repo#number> --issue-body <issue-body-file> --document <requirements-file> --kind artifact --repo-root <repo-root> --workspace <workspace> --goal-document <goal-file>`
  - `python3 .agents/skills/aidd-cycle/scripts/render_aidd_artifact.py --repo-root <repo-root> --source <requirements-file> --output <generated-requirements-md> --check`
- 手動確認:
  - 必要に応じて監督者が受け入れ条件とStop条件を確認する

## Stop

- 要件の意図が複数解釈できる
- 対象ユーザーや成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要そう
- error、empty、権限不足などの状態でユーザー向け操作が必要か一意に決められず、Design / Planでプロダクト判断が必要になる
- Issue本文または選択したproduct/domain ruleから読み取れない要求や成功条件を追加する必要がある
- 対象Issue本文を取得できない
- 同じIssue番号のworkspaceが複数ある、既存の唯一のworkspaceと指定名が一致しない、またはworkspace名がversion/retry派生である
- Requirements Input Gateが失敗する
- `direct_rules`が空、または成果物のいずれかのRequirements Gateが保持したGoalと一致しない
- Requirements Goalまたは成果物が今回の差分だけへ狭められている、前回要求項目・主要sectionが根拠なく欠落または変更されている、またはRequirements Completeness Gateが失敗する
- validator上は存在するIssue根拠が、対応する要求項目またはsectionの変更・追加・廃止を意味的に一意に正当化しない
- Requirements作成中にIssueのURL、updatedAt、本文、または本文SHA-256が変わった
- direct nodeの選択をIssue本文の根拠内に存在する`applies_to`一致値へ追跡できない
- direct nodeから必要な推移的`depends_on`閉包または接続edgeが欠けている
- `docs/harness/rule-map.json` で選ぶべき関連ドキュメントが曖昧
- Requirements / PRDが選択したルール・ポリシーに違反している、または違反の可能性がある
````

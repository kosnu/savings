---
title: Design / Plan Goal Template
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
  - design-doc
  - planning
  - temporal-data
when_to_read:
  - Requirements / PRDをもとにDesign Docを作成するとき
  - 実装方針、影響範囲、テスト方針を整理するとき
---

# Design / Plan Goal

````md
# Design / Plan Goal

## Goal

最新のRequirements / PRD全体をもとに、実装方針・影響範囲・テスト方針を明確にする。

## Inputs

- Requirements / PRD: 同じworkspaceのcanonical `requirements.json`。コピー、一時ファイル、symlink aliasは不可。生成`requirements.md`もread-only。
- Requirements Input / Completeness Gate再検証結果:
- Issue snapshot再検証入力: canonical URL、`updatedAt`、Issue本文file
- Rule map: canonical `docs/harness/rule-map.json`
- Requirements SHA-256:
- Requirements IDs: 全`FR-*`、`NFR-*`、`AC-*`
- Workspace identity検証結果: Requirementsと同じ検証済みworkspace
- Goal source: temporary `design_goal` JSON。このJSONを検証し、型付き`display` fieldから生成したGoal objectiveを使う。
- Goal contract IDs: constraintsは`canonical-input`、`phase-boundary`、Stopは`validation-failure`、`scope-ambiguity`、Done / Verificationは`complete-scope`、`validated-artifact`を必須とする。各entryは`id`と[workflow](../workflow.md)のcanonical textを持ち、task固有条件には別の安定IDを付ける。
- 出力先: 同じworkspaceのcanonical `design-doc.json`。このGoalが書き込みを所有し、`design-doc.md`を生成する。
- Git `HEAD`のcanonical Design baseline: validatorが`--workspace`から自動取得したSHA-256とsection inventory
- 関連コード:
- 関連ドキュメント:
  - docs/harness/rule-map.json で選択したサブグラフ:
- 既存テスト:

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- 作業分類:
  - path:
  - domain:
  - activity:
  - topic:
- Selected nodes: `id` -> `file`: reason
- Depends-on nodes: `id` -> `file`: reason
- Conflict decision: none / overrides / priority

## Scope

- 対象Requirements: 現在のRequirements / PRD全体。今回追加・変更された要求だけへ狭めない。
- 今回のRequirements差分: なし / Designへ統合する変更点。Goal scopeではない。
- 対象ディレクトリ:
- 変更候補:
- 対象外:

## Design Coverage Gate

Goal作成前は、temporary `design_goal` JSONの`validation.coverage_gate`へcanonical Requirements JSONのSHA-256と全識別子をcanonical順で記録し、各ID専用の設計scopeと検証scopeを`validation.scopes`へ作る。Git baselineがある場合は全section専用のreview scopeを`validation.baseline_scopes`へ作り、`--kind goal`で検証する。baselineはvalidatorがcanonical `design-doc.json`をGit `HEAD`から取得する。生成する`design-doc.json`では各IDを専用の`coverage` entryへ対応させ、Git baselineの全構造化sectionに対する`preserved`または`replaced`の判断を記録して`--kind artifact`で検証する。複数IDまたは複数baseline sectionの一括coverage、別IDを含む根拠、IDを含まない共通文は使えない。Goal Markdownと生成Markdownは機械検証入力にしない。

```json
{
  "requirements_sha256": "64文字のSHA-256",
  "workspace": "123-example",
  "requirement_ids": ["FR-1"],
  "baseline": {
    "source": "git_head",
    "body_sha256": "64文字のSHA-256"
  }
}
```

Design Docのartifact form:

```json
{
  "requirements_sha256": "64文字のSHA-256",
  "workspace": "123-example",
  "requirement_ids": ["FR-1"],
  "baseline": {
    "source": "git_head",
    "body_sha256": "64文字のSHA-256"
  },
  "coverage": [
    {
      "id": "FR-1",
      "design_block_id": "fr-1-design-evidence",
      "verification_block_id": "fr-1-verification-evidence"
    }
  ],
  "baseline_sections": [
    {
      "section_id": "implementation-policy",
      "heading": "実装方針",
      "content_sha256": "validatorがGitから導出したsectionと同じSHA-256",
      "status": "preserved",
      "design_block_id": "implementation-policy-baseline-evidence"
    }
  ]
}
```

各block IDは`design-doc.json`のtyped `evidence` blockを参照する。requirement coverage blockは`role: design`または`role: verification`と対象Requirements IDの`owner_id`を持ち、baseline blockは`role: baseline`と対象`section_id`の`owner_id`を持つ。`text`には根拠本文だけを入れ、owner/roleラベルはrendererが構造化fieldから生成する。legacy baselineだけは`section_id: null`とし、見出しを`owner_id`に使う。Git `HEAD`に前回Design Docがない場合は、baselineを`source: none`、`body_sha256: null`とし、artifactの`baseline_sections`も空配列にする。baselineの全section inventoryはvalidatorがGitから導出する。

## Requirement Design Scope

Goal JSONの`validation.scopes`に、全Requirements IDそれぞれの`design_scope`と`verification_scope`を別entryとして記載する。各scope fieldには本文だけを入れ、IDとscope種別のラベルはrendererがentryの`id`から生成する。

- FR-1 design scope: 設計対象を具体的に記載する。
- FR-1 verification scope: 検証対象を具体的に記載する。

Git baselineがある場合は、Goal JSONの`validation.baseline_scopes`へ全構造化sectionごとに`section_id`、`heading`、一意な`review_scope`を記載する。legacy baselineだけは`section_id: null`とする。

- 実装方針 baseline scope: 現在Requirementsへ再適合させる。

## Domain Value UI Decisions

UIに表示、入力、比較、集計、状態化するドメイン値がある場合、Requirements / PRDの利用目的に沿って、Design Docで次を決める。

- 対象のドメイン値:
- 利用目的:
  - 実値を知りたい
  - 比較したい
  - 残量や到達可否を知りたい
  - 制約に違反していないか知りたい
  - 内訳を確認したい
  - 対象を識別したい
- UIで主に見せるもの:
  - 値そのもの
  - 判断結果
  - 状態
  - 内訳
  - 識別情報
- 比較元、基準値、許可範囲、分類、期間を表示するか:
- loading / empty / error / 未設定 / 0 / 不明 / 削除済みの扱い:
- rule-mapで選択されたWeb UIルール上の文字階層、一覧、余白、button variant、フォーム、overlay、responsiveとの対応:

## Autonomy

- AIは既存実装を調査してよい
- AIは複数案を比較してよい
- AIは推奨案を提示してよい
- AIはStop条件に当たらない限り、Build / Verify Goalへ進むための入力を整理してよい
- AIはこのGoal内では実装してはいけない

## Done

- [ ] 変更対象ファイル・モジュールが整理されている
- [ ] 採用する実装方針が説明されている
- [ ] 採用しない案と理由がある
- [ ] 関連するドメインルールとの整合性が確認されている
- [ ] `docs/harness/rule-map.json` で選択した関連ドキュメントとの整合性が確認されている
- [ ] UIにドメイン値が出る場合、値ごとの利用目的と主表示が決まっている
- [ ] 複数データ更新がある場合、トランザクション単位と操作境界が整理されている
- [ ] 有効期間、履歴、月次状態、削除が関わる場合、過去状態の暗黙復活を避ける設計になっている
- [ ] ユーザーに表示される主要文言がDesign Docで決まっている
- [ ] 既存挙動への影響が整理されている
- [ ] テスト方針がPRDの受け入れ条件と対応している
- [ ] Design GoalとDesign Docが現在のRequirements全体をscopeとし、今回の差分だけへ狭まっていない
- [ ] 入力が同じworkspaceのcanonical `requirements.json`であり、Requirements Input / Completeness Gateの再検証が成功している
- [ ] 全`FR-*`、`NFR-*`、`AC-*`に、対象IDだけを含む専用行の設計根拠と検証根拠が1件ずつある
- [ ] Git `HEAD`の前回Design JSONにある全構造化sectionが、headingを明記した一意な根拠とともに`preserved`または`replaced`へ分類されている
- [ ] Design Coverage GateがGoal作成前とDesign Doc完了前の両方で成功している
- [ ] 追加、変更、削除する各ユーザー向け操作が、Requirements / PRDの機能要件・受け入れ条件、または明示された正本ルールに追跡できる
- [ ] Requirements / PRDの意図・制約・対象外・受け入れ条件から解釈を広げていない
- [ ] 現在サイクルのRequirements / PRDをread-only入力として扱っている
- [ ] 成果物が同じworkspaceのcanonical `design-doc.json`にあり、rendererで`design-doc.md`とのUTF-8文字列一致（CRLF/LF差は正規化）を確認している
- [ ] Design Docが、選択したルール・ポリシーに違反していないことを確認している
- [ ] リスクと確認事項が残っている

## Verification

- 必ず実行:
  - `python3 .agents/skills/aidd-cycle/scripts/validate_design_coverage.py --issue <owner/repo#number> --issue-url <canonical-issue-url> --issue-updated-at <updatedAt> --issue-body <issue-body-file> --rule-map <canonical-rule-map> --requirements <canonical-requirements-file> --document <design-file> --kind artifact --repo-root <repo-root> --workspace <workspace>`
  - `python3 .agents/skills/aidd-cycle/scripts/render_aidd_artifact.py --repo-root <repo-root> --source <design-file> --output <generated-design-md> --check`
- 必要なら実行:
  - 既存テストや型定義の調査コマンド
- 手動確認:
  - 必要に応じて監督者がリスク、逸脱、Stop条件を確認する

## Stop

- 実装方針がプロダクト判断を含む
- PRDの受け入れ条件が曖昧
- Requirementsの`FR-*`、`NFR-*`、`AC-*`識別子が不足している
- Requirements Completeness Gateが失敗する、または入力Requirementsが最新Issue全体を覆っていない
- Design GoalまたはDesign Docが今回追加・変更された要求だけへscopeを狭めている
- Git `HEAD`の前回Design sectionをすべて維持または置換として追跡できない
- IDまたはheadingを含む根拠が、対応する特定要求または前回sectionを実際には解決していない
- Design Coverage Gateが失敗する
- 既存のドメインルールと矛盾する
- 影響範囲が想定より広い
- DB / API / 認証 / 権限変更が必要
- トランザクション単位を決めるための仕様判断が不足している
- 現在有効な状態と過去時点の表示を分けるための仕様判断が不足している
- ユーザーに表示される主要文言を決めるための情報が不足している
- ユーザー向け操作の根拠をRequirements / PRDまたは明示された正本ルールに追跡できず、一般的なUX、既存実装、既存パターンから補う必要がある
- Requirements / PRDにないプロダクト判断、対象機能、成功条件をDesign Docに追加する必要がある
- `docs/harness/rule-map.json` で選ぶべき関連ドキュメントが曖昧
- Design Docが選択したルール・ポリシーに違反している、または違反の可能性がある
````

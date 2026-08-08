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

- Requirements / PRD: 同じworkspaceのcanonical `requirements.md`。コピー、一時ファイル、symlink aliasは不可。
- Requirements Completeness Gate検証結果:
- Requirements SHA-256:
- Requirements IDs: 全`FR-*`、`NFR-*`、`AC-*`
- Workspace identity検証結果: Requirementsと同じ検証済みworkspace
- 出力先: 同じworkspaceのcanonical pathである`design-doc.md`。このGoalが書き込みを所有する。
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

Goal作成前は、以下のJSONへcanonical RequirementsのSHA-256と全識別子をcanonical順で記録し、各ID専用の設計scopeと検証scopeを対象IDだけを含む別々の行へ作って`--kind goal`で検証する。baselineはvalidatorがcanonical `design-doc.md`をGit `HEAD`から取得する。生成する`design-doc.md`では各IDを、対象IDだけを含む専用の根拠行へ対応させた`coverage`と、Git baselineの全level-two sectionに対する`preserved`または`replaced`の判断を記録して`--kind artifact`で検証する。複数IDの一括coverage、別IDを含む行の部分文字列、IDを含まない共通文は使えない。

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
      "design_evidence": "FR-1 design: Gate外にある実質的な設計原文。",
      "verification_evidence": "FR-1 verification: Gate外にある実質的な検証原文。"
    }
  ],
  "baseline_sections": [
    {
      "heading": "実装方針",
      "content_sha256": "validatorがGitから導出したsectionと同じSHA-256",
      "status": "preserved",
      "design_evidence": "実装方針を明記したGate外の維持または置換判断の原文"
    }
  ]
}
```

Git `HEAD`に前回Design Docがない場合は、baselineを`source: none`、`body_sha256: null`とし、artifactの`baseline_sections`も空配列にする。baselineの全section inventoryはvalidatorがGitから導出する。

## Requirement Design Scope

Gate外に、全Requirements IDそれぞれの`design_scope`と`verification_scope`を、対象IDだけを含む別々の行として原文一致で記載する。

- FR-1 design scope: 設計対象を具体的に記載する。
- FR-1 verification scope: 検証対象を具体的に記載する。

Git baselineがある場合は、全level-two sectionごとにheadingを含む一意なreview scopeも記載する。

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
- [ ] 入力が同じworkspaceのcanonical `requirements.md`であり、Requirements Completeness Gateが成功している
- [ ] 全`FR-*`、`NFR-*`、`AC-*`に、対象IDだけを含む専用行の設計根拠と検証根拠が1件ずつある
- [ ] Git `HEAD`の前回Design Docにある全level-two sectionが、headingを明記した一意な根拠とともに`preserved`または`replaced`へ分類されている
- [ ] Design Coverage GateがGoal作成前とDesign Doc完了前の両方で成功している
- [ ] 追加、変更、削除する各ユーザー向け操作が、Requirements / PRDの機能要件・受け入れ条件、または明示された正本ルールに追跡できる
- [ ] Requirements / PRDの意図・制約・対象外・受け入れ条件から解釈を広げていない
- [ ] 現在サイクルのRequirements / PRDをread-only入力として扱っている
- [ ] 成果物が同じworkspaceのcanonical pathである`design-doc.md`にある
- [ ] Design Docが、選択したルール・ポリシーに違反していないことを確認している
- [ ] リスクと確認事項が残っている

## Verification

- 必ず実行:
  - `python3 .agents/skills/aidd-cycle/scripts/validate_design_coverage.py --issue <owner/repo#number> --requirements <canonical-requirements-file> --document <design-file> --kind artifact --repo-root <repo-root> --workspace <workspace>`
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

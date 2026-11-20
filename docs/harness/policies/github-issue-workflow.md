---
title: GitHub Issue Workflow
doc_type: policy
status: accepted
area: repository
applies_to:
  - .github/ISSUE_TEMPLATE
topics:
  - github
  - issue
  - project
when_to_read:
  - このリポジトリのIssueを作成するとき
  - Issue作成時のAutomation初期値を判断するとき
---

# GitHub Issue Workflow

`kosnu/savings` の新規Issueに設定する初期値を定める。
テンプレートは[Issue Template Selection](issue-template-selection.md)、本文は[Intentの記述](../../ai-driven-development/issue-guidelines.md)に従う。
Issue作成の承認条件は、利用する作成手順に従う。

## Automationの初期値

設定先はIssue本体の `Automation` Issue Fieldとする。Projectへの追加・Projectフィールドの更新は、この初期設定の一部として行わない。

1. Issue Fieldの定義と、作成したIssueでの現在値を取得する。取得失敗を未設定として扱わない。
2. ユーザーが `Automation` の値を明示した場合は、その指定を適用する。
3. 指定がなく値が設定済みなら保持する。`Disabled` も上書きしない。未設定の場合だけ `Enabled` を設定し、`Priority` や他のフィールドは変更しない。
4. 値を再取得し、指定値、保持した値、または既定値を確認する。

`gh api graphql` でリポジトリの `issueFields` を取得し、`Automation` のsingle-select fieldと対象optionを実際の定義から特定する。
Issueの値の取得・更新には[Issue field valuesのREST API](https://docs.github.com/en/rest/issues/issue-field-values)を使用できる。更新するときは `POST` で該当フィールドだけを指定し、全置換の `PUT` は使わない。

アクセス・フィールドの特定・反映確認に失敗した場合は、作成済みIssueのURLと初期値の設定が未完了であることを報告する。Issueを重複作成したりフィールドやoptionを新設したりしない。既存Issueの一括更新は行わない。

## GitHub Actionsによる自動設定

[Initialize issue automation field](../../../.github/workflows/issue_project_automation.yaml)は、`kosnu/savings` の `issues.opened` で起動する。Issue Fieldが未設定のときだけ `Enabled` にする。Projectへ自動追加しない。

このジョブは `contents: read` と `issues: write` の `GITHUB_TOKEN` を使用し、追加のPATやSecretは使わない。対象はこのリポジトリで確認済みの `Automation` の数値ID。フィールドを再作成した場合は、Issue Field定義から番号を再確認してスクリプトの参照先を更新する。

API失敗・不正な値・反映確認の失敗はrunを失敗にする。マージ後の新規IssueのActions runで、Issue本体の `Automation` に反映されていることを確認する。
`GITHUB_TOKEN` によるIssue作成では後続のActionsイベントが起動しないため、その経路では上記の手順で設定する。
認証と起動条件はGitHub公式の [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) と[イベントの再帰起動制限](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#triggering-a-workflow-from-a-workflow)に従う。

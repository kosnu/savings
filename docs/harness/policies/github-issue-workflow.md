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
  - Issue作成時のプロジェクト登録を判断するとき
---

# GitHub Issue Workflow

このリポジトリのIssue作成時のプロジェクト登録と初期値を定める。
テンプレートは[Issue Template Selection](issue-template-selection.md)、本文は[Intentの記述](../../ai-driven-development/issue-guidelines.md)に従う。
Issue作成の承認条件は、利用する作成手順に従う。

## 対象プロジェクト

`kosnu/savings` のIssueを [savingsプロジェクト](https://github.com/users/kosnu/projects/2) へ追加する場合に適用する。
別のプロジェクトへこの初期値を転用しない。

## Automationの初期値

新規Issueをsavingsプロジェクトに追加する。初期値を設定する対象はProjectの列ではなく、`kosnu/savings` のIssue本体にある `Automation` Issue Fieldとする。

1. Issue Fieldの定義と、作成したIssueでの現在値を取得する。取得失敗を未設定として扱わない。
2. ユーザーが `Automation` の値を明示した場合は、その指定を適用する。
3. 指定がなく値が設定済みなら保持する。`Disabled` も上書きしない。未設定の場合だけ `Enabled` を設定し、`Priority` や他のフィールドは変更しない。
4. 値を再取得し、指定値、保持した値、または既定値を確認する。

`gh api graphql` でリポジトリの `issueFields` とIssueの `issueFieldValues` を取得する。IDを固定値として埋め込まず、`Automation` のsingle-select fieldと対象optionを実際の定義から特定する。更新するときは `setIssueFieldValue` で該当フィールドだけを指定する。

アクセス・フィールドの特定・反映確認に失敗した場合は、作成済みIssueのURLと初期値の設定が未完了であることを報告する。Issueを重複作成したりフィールドやoptionを新設したりしない。既存Issueの一括更新は行わない。

## GitHub Actionsによる自動設定

[Initialize issue project automation](../../../.github/workflows/issue_project_automation.yaml)は、`kosnu/savings` の `issues.opened` で起動する。新規Issueのsavingsプロジェクトへの追加は従来どおり行うが、Projectの `Automation` は更新せず、Issue Fieldが未設定のときだけ `Enabled` にする。登録済みのProject itemと、設定済みのIssue Fieldの値は再実行時にも維持する。

Repository Actions Secret `PROJECT_AUTOMATION_TOKEN` には、対象ProjectとIssueの両方を更新できる既存の認証情報を使う。classic PATではProjectの更新に `project` scope、非公開リポジトリのIssueの更新に `repo` scopeが必要になる。`GITHUB_TOKEN` はユーザー所有のProjectへアクセスできない。

Secret不足、Project・Issue Field・optionの欠落、API失敗、反映確認の失敗はrunを失敗にする。マージ後の新規IssueのActions runで、Issue本体の `Automation` に反映されていることを確認する。`GITHUB_TOKEN` によるIssue作成では後続のActionsイベントが起動しないため、その経路では上記の手順で設定する。

認証と起動条件はGitHub公式の[Issue Fieldsの管理](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-and-managing-issue-fields#using-issue-fields-with-the-api)、[ProjectsのActions自動化](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)、[イベントの再帰起動制限](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#triggering-a-workflow-from-a-workflow)に従う。

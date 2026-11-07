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

Issue作成とプロジェクトへの追加後、次の処理を行う。

1. 作成したIssueに対応する対象プロジェクトのitemと、`Automation` の現在値を取得する。取得失敗を未設定として扱わない。
2. ユーザーが `Automation` の値を明示した場合は、その指定を適用する。
3. 値が設定済みなら保持する。`Disabled` も上書きしない。未設定の場合だけ `Enabled` を設定し、他のフィールドは変更しない。
4. 現在値を再取得し、指定値、保持した値、または既定値が反映されていることを確認して完了を報告する。

操作には `gh api graphql` で取得した対象project・item・field・optionのIDを使う。IDを固定値として埋め込まず、`Automation` のsingle-select fieldと `Enabled` optionを実際の定義から特定する。
更新には `gh project item-edit --id <item-id> --project-id <project-id> --field-id <field-id> --single-select-option-id <option-id>` を使える。

item・field・optionが見つからない、アクセスできない、反映を確認できない場合は、作成済みIssueのURLと初期値設定が未完了であることを報告する。
Issueを重複作成したり、fieldやoptionを新設したりしない。

上記はagentが新規Issueを作成するときの手順であり、既存Issueの一括更新は対象に含めない。

## GitHub Actionsによる自動設定

[Initialize issue project automation](../../../.github/workflows/issue_project_automation.yaml)は、`kosnu/savings` の `issues.opened` で起動する。GitHub画面・CLIなどの作成経路を問わず、新規Issueをsavingsプロジェクトへ追加し、`Automation` が未設定の場合だけ `Enabled` にする。設定済みの値は保持し、更新後は再取得して反映を確認する。登録済みitemは再利用するため、agentの手順やProjectの自動追加と併存できる。

利用開始には、次の設定が必要になる。

1. Projectへアクセスできるアカウントで、`project` scopeを持つpersonal access token (classic)を作成する。非公開リポジトリのIssueにアクセスする場合は `repo` scopeも付ける。
2. `kosnu/savings` のRepository Actions Secretへ `PROJECT_AUTOMATION_TOKEN` として登録する。既定の `GITHUB_TOKEN` はユーザー所有のProjectへアクセスできない。
3. Workflowをデフォルトブランチへmergeした後、新規IssueのActions runとProjectの `Automation` を確認する。

Secret不足、Project・field・optionの欠落、API失敗、反映確認の失敗はrunを失敗にする。原因を解消した後は該当runを再実行する。既存Issueの一括更新は行わない。`GITHUB_TOKEN` によるIssue作成では後続のActionsイベントが起動しないため、その経路では上記agent手順などで設定する。

認証と起動条件はGitHub公式の[ProjectsのActions自動化](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)と[イベントの再帰起動制限](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#triggering-a-workflow-from-a-workflow)に従う。

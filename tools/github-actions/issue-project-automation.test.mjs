import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import initialize from "./issue-project-automation.cjs"

const route = "/repos/kosnu/savings/issues/{issue_number}/issue-field-values"
const headers = { accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" }
const issueParams = { issue_number: 42, headers }
const automation = (name) => ({
  issue_field_id: 50147379,
  issue_field_name: "Automation",
  data_type: "single_select",
  single_select_option: { name },
})
const priority = {
  issue_field_id: 1234,
  issue_field_name: "Priority",
  data_type: "single_select",
  single_select_option: { name: "High" },
}

function fixture({
  initial = [priority],
  after = [priority, automation("Enabled")],
  errorAt,
  context = { repo: { owner: "kosnu", repo: "savings" }, payload: { issue: { number: 42 } } },
} = {}) {
  const calls = []
  const request = async (route, params) => {
    calls.push({ route, params })
    if (calls.length === errorAt) throw new Error("API unavailable")
    if (route === "POST /repos/kosnu/savings/issues/{issue_number}/issue-field-values") {
      return { data: [] }
    }
    return { data: calls.length === 1 ? initial : after }
  }
  return { calls, run: () => initialize({ github: { request }, context, core: { info() {} } }) }
}

test("Workflowは対象の新規Issueのみで実行し、既定トークンの権限はジョブに限定する", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/issue_project_automation.yaml", import.meta.url),
    "utf8",
  )
  assert.match(workflow, /issues:\n    types: \[opened\]/)
  assert.match(workflow, /^permissions: \{\}$/m)
  assert.match(workflow, /if: github.repository == 'kosnu\/savings'/)
  assert.match(workflow, /permissions:\n      contents: read\n      issues: write/)
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /github-token: \$\{\{ github\.token \}\}/)
  assert.doesNotMatch(workflow, /PROJECT_AUTOMATION_TOKEN|secrets\./)
  assert.match(
    workflow,
    /^\s+script: await require\('\.\/tools\/github-actions\/issue-project-automation\.cjs'\)\(\{github, context, core\}\)$/m,
  )
})

test("未設定ならAutomationだけをPOSTし、同じIssueから再取得する", async () => {
  const { calls, run } = fixture()
  await run()
  assert.deepEqual(calls, [
    { route: `GET ${route}`, params: issueParams },
    {
      route: `POST ${route}`,
      params: {
        ...issueParams,
        issue_field_values: [{ field_id: 50147379, value: "Enabled" }],
      },
    },
    { route: `GET ${route}`, params: issueParams },
  ])
})

test("Issue Fieldが何も設定されていなくても初期値を設定できる", async () => {
  await fixture({ initial: [] }).run()
})

for (const current of ["Enabled", "Disabled", "Future option"]) {
  test(`設定済みの${current}は上書きしない`, async () => {
    const { calls, run } = fixture({ initial: [priority, automation(current)] })
    await run()
    assert.deepEqual(calls, [{ route: `GET ${route}`, params: issueParams }])
  })
}

for (const issueNumber of ["42", 0, -1, 1.5, "../issues"]) {
  test(`Issue番号${issueNumber}が不正ならAPIを呼ばない`, async () => {
    const { calls, run } = fixture({
      context: {
        repo: { owner: "kosnu", repo: "savings" },
        payload: { issue: { number: issueNumber } },
      },
    })
    await assert.rejects(run(), /valid kosnu\/savings issue/)
    assert.deepEqual(calls, [])
  })
}

test("別のリポジトリからはAPIを呼ばない", async () => {
  const { calls, run } = fixture({
    context: { repo: { owner: "kosnu", repo: "different" }, payload: { issue: { number: 42 } } },
  })
  await assert.rejects(run(), /valid kosnu\/savings issue/)
  assert.deepEqual(calls, [])
})

for (const initial of [
  null,
  [{ issue_field_id: "50147379" }],
  [automation("")],
  [{ ...automation("Enabled"), issue_field_id: 2 }],
  [{ ...automation("Enabled"), issue_field_name: "Renamed field" }],
  [{ ...automation("Enabled"), data_type: "text" }],
  [automation("Disabled"), automation("Disabled")],
]) {
  test("不正・重複・フィールド変更の応答は未設定として扱わない", async () => {
    const { calls, run } = fixture({ initial })
    await assert.rejects(run())
    assert.deepEqual(calls, [{ route: `GET ${route}`, params: issueParams }])
  })
}

for (const errorAt of [1, 2, 3]) {
  test(`API呼び出し${errorAt}の失敗を成功扱いしない`, async () => {
    const { calls, run } = fixture({ errorAt })
    await assert.rejects(run(), /API unavailable/)
    assert.equal(calls.length, errorAt)
  })
}

for (const after of [[], [automation("Disabled")]]) {
  test("更新後にEnabledが確認できなければ失敗する", async () => {
    const { run } = fixture({ after })
    await assert.rejects(run(), /not confirmed/)
  })
}

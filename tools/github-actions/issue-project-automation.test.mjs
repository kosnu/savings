import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import initialize from "./issue-project-automation.cjs"

const priority = {
  __typename: "IssueFieldSingleSelectValue",
  field: { id: "priority" },
  name: "High",
}

function fixture({
  current = null,
  confirmed = "Enabled",
  missing,
  errorAt,
  token = "test-token",
} = {}) {
  const calls = []
  let reads = 0
  const graphql = async (query, variables) => {
    const operation = query.match(/(?:query|mutation)\s*(?:\([^]*?\))?\s*{\s*(\w+)/)[1]
    calls.push({ operation, query, variables })
    if (operation === errorAt) throw new Error("API unavailable")
    switch (operation) {
      case "user":
        return {
          user: { projectV2: missing === "project" ? null : { id: "project" } },
          repository: {
            viewerCanSeeIssueFields: missing !== "visibility",
            issueFields: {
              pageInfo: { hasNextPage: missing === "field-pagination" },
              nodes:
                missing === "field"
                  ? []
                  : [
                      { id: "priority", name: "Priority", options: [{ id: "high", name: "High" }] },
                      {
                        id: "automation",
                        name: "Automation",
                        options: missing === "option" ? [] : [{ id: "enabled", name: "Enabled" }],
                      },
                    ],
            },
          },
        }
      case "addProjectV2ItemById":
        return { addProjectV2ItemById: { item: missing === "item" ? null : { id: "item" } } }
      case "node": {
        const name = reads++ === 0 ? current : confirmed
        const nodes = [priority]
        if (name !== null) {
          nodes.push({
            __typename: "IssueFieldSingleSelectValue",
            field: { id: "automation" },
            name,
          })
        }
        return {
          node:
            missing === "read"
              ? null
              : {
                  id: "issue",
                  issueFieldValues: {
                    pageInfo: { hasNextPage: missing === "value-pagination" },
                    nodes,
                  },
                },
        }
      }
      case "setIssueFieldValue":
        return {
          setIssueFieldValue: { issue: missing === "updated-issue" ? null : { id: "issue" } },
        }
      default:
        throw new Error(`Unexpected operation: ${operation}`)
    }
  }
  return {
    calls,
    run: async () =>
      initialize({
        github: { graphql },
        context: { payload: { issue: { node_id: "issue" } } },
        core: { info() {} },
        token,
      }),
  }
}

test("Workflowは信頼済みcommitのスクリプトを単行で呼び出す", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/issue_project_automation.yaml", import.meta.url),
    "utf8",
  )
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /PROJECT_AUTOMATION_TOKEN: \$\{\{ secrets\.PROJECT_AUTOMATION_TOKEN \}\}/)
  assert.match(
    workflow,
    /^\s+script: await require\('\.\/tools\/github-actions\/issue-project-automation\.cjs'\)\(\{github, context, core\}\)$/m,
  )
})

test("SecretがなければAPIへアクセスせず失敗する", async () => {
  const { calls, run } = fixture({ token: "" })
  await assert.rejects(run(), /Set repository secret PROJECT_AUTOMATION_TOKEN/)
  assert.deepEqual(calls, [])
})

test("Project登録を維持し、未設定ならPriorityでなくAutomation Issue Fieldだけを更新して再取得する", async () => {
  const { calls, run } = fixture()
  await run()
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    ["user", "addProjectV2ItemById", "node", "setIssueFieldValue", "node"],
  )
  assert.deepEqual(calls[1].variables, { project: "project", issue: "issue" })
  assert.match(calls[2].query, /issueFieldValues/)
  assert.match(
    calls[3].query,
    /issueFields: \[\{fieldId: \$field, singleSelectOptionId: \$option\}\]/,
  )
  assert.deepEqual(calls[3].variables, { issue: "issue", field: "automation", option: "enabled" })
  assert.deepEqual(calls[4].variables, { issue: "issue" })
})

for (const current of ["Enabled", "Disabled", "Future option"]) {
  test(`設定済みの${current}は再実行でも上書きしない`, async () => {
    const { calls, run } = fixture({ current })
    await run()
    assert.deepEqual(
      calls.map(({ operation }) => operation),
      ["user", "addProjectV2ItemById", "node"],
    )
  })
}

for (const missing of [
  "project",
  "visibility",
  "field-pagination",
  "field",
  "option",
  "item",
  "read",
  "value-pagination",
]) {
  test(`${missing}が取得できなければ値を更新せず失敗する`, async () => {
    const { calls, run } = fixture({ missing })
    await assert.rejects(run())
    assert.ok(calls.every(({ operation }) => operation !== "setIssueFieldValue"))
  })
}

test("値の形式が不正なときは未設定として扱わない", async () => {
  const { run } = fixture({ current: "" })
  await assert.rejects(run(), /Automation Issue Field value could not be read/)
})

for (const errorAt of ["user", "addProjectV2ItemById", "node", "setIssueFieldValue"]) {
  test(`${errorAt}のAPI失敗は成功扱いにしない`, async () => {
    const { run } = fixture({ errorAt })
    await assert.rejects(run(), /API unavailable/)
  })
}

test("更新時に対象Issueが返らなければ失敗する", async () => {
  const { run } = fixture({ missing: "updated-issue" })
  await assert.rejects(run(), /not confirmed/)
})

test("更新後にEnabledを確認できなければ失敗する", async () => {
  const { run } = fixture({ confirmed: null })
  await assert.rejects(run(), /not confirmed/)
})

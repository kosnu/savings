import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(
  new URL("../../.github/workflows/issue_project_automation.yaml", import.meta.url),
  "utf8",
)
// YAML全体の検証はactionlintが担当し、ここでは実際のscript本文のAPI分岐を確認する。
const script = workflow.split("          script: |\n")[1]
assert.ok(script, "Workflow must contain the initialization script")
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
const initialize = new AsyncFunction("github", "context", "core", script)

function fixture({ current = null, confirmed = "enabled", missing, errorAt } = {}) {
  const calls = []
  let reads = 0
  const graphql = async (query, variables) => {
    const operation = query.match(/(?:query|mutation)\s*(?:\([^]*?\))?\s*{\s*(\w+)/)[1]
    calls.push({ operation, variables })
    if (operation === errorAt) throw new Error("API unavailable")
    switch (operation) {
      case "user":
        return {
          user: {
            projectV2:
              missing === "project"
                ? null
                : {
                    id: "project",
                    field:
                      missing === "field"
                        ? null
                        : {
                            id: "automation",
                            options:
                              missing === "option" ? [] : [{ id: "enabled", name: "Enabled" }],
                          },
                  },
          },
        }
      case "addProjectV2ItemById":
        return { addProjectV2ItemById: { item: missing === "item" ? null : { id: "item" } } }
      case "node": {
        const optionId = reads++ === 0 ? current : confirmed
        return {
          node:
            missing === "read"
              ? null
              : {
                  id: "item",
                  fieldValueByName: optionId === null ? null : { optionId },
                },
        }
      }
      case "updateProjectV2ItemFieldValue":
        return { updateProjectV2ItemFieldValue: { projectV2Item: { id: "item" } } }
      default:
        throw new Error(`Unexpected operation: ${operation}`)
    }
  }
  return {
    calls,
    run: () => initialize({ graphql }, { payload: { issue: { node_id: "issue" } } }, { info() {} }),
  }
}

test("未設定ならIssueを登録してAutomationだけをEnabledに更新し、再取得する", async () => {
  const { calls, run } = fixture()
  await run()
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    ["user", "addProjectV2ItemById", "node", "updateProjectV2ItemFieldValue", "node"],
  )
  assert.deepEqual(calls[1].variables, { project: "project", issue: "issue" })
  assert.deepEqual(calls[3].variables, {
    project: "project",
    item: "item",
    field: "automation",
    option: "enabled",
  })
})

for (const current of ["enabled", "disabled", "another-option"]) {
  test(`設定済みの${current}は再実行でも上書きしない`, async () => {
    const { calls, run } = fixture({ current })
    await run()
    assert.deepEqual(
      calls.map(({ operation }) => operation),
      ["user", "addProjectV2ItemById", "node"],
    )
  })
}

for (const missing of ["project", "field", "option", "item", "read"]) {
  test(`${missing}が取得できなければ値を更新せず失敗する`, async () => {
    const { calls, run } = fixture({ missing })
    await assert.rejects(run())
    assert.ok(calls.every(({ operation }) => operation !== "updateProjectV2ItemFieldValue"))
  })
}

test("値の形式が不正なときは未設定として扱わない", async () => {
  const { run } = fixture({ current: "" })
  await assert.rejects(run(), /Automation value could not be read/)
})

for (const errorAt of ["user", "addProjectV2ItemById", "node", "updateProjectV2ItemFieldValue"]) {
  test(`${errorAt}のAPI失敗は成功扱いにしない`, async () => {
    const { run } = fixture({ errorAt })
    await assert.rejects(run(), /API unavailable/)
  })
}

test("更新後にEnabledを確認できなければ失敗する", async () => {
  const { run } = fixture({ confirmed: null })
  await assert.rejects(run(), /not confirmed/)
})

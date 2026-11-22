import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./harness-gate.mjs", import.meta.url))
const head = "a".repeat(40)
const other = "b".repeat(40)

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "harness-gate-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, "gh"), '#!/bin/sh\nprintf "%s\\n" "$@" >&2\nexit "${GH_EXIT:-0}"\n', {
    mode: 0o755,
  })
  return (phase, overrides = {}) =>
    spawnSync(process.execPath, [script, phase], {
      encoding: "utf8",
      env: {
        PATH: `${dir}${delimiter}${process.env.PATH}`,
        GITHUB_REPOSITORY: "kosnu/savings",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_RUN_ID: "9",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_SHA: other,
        EXPECTED_HEAD: head,
        CONTEXT_HEAD: head,
        CANDIDATE_RESULT: "success",
        INTEGRATION_RESULT: "success",
        ...overrides,
      },
    })
}

function assertStatus(result, state) {
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stderr.trim().split("\n"), [
    "api",
    "--method",
    "POST",
    `repos/kosnu/savings/statuses/${head}`,
    "-f",
    `state=${state}`,
    "-f",
    "context=harness-gate",
    "-f",
    `description=Harness CI: ${state}`,
    "-f",
    "target_url=https://github.com/kosnu/savings/actions/runs/9",
  ])
}

test("PRとdispatchは検証済みheadにpendingと完了状態を送る", (t) => {
  const run = fixture(t)
  for (const env of [{}, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: head }]) {
    assertStatus(run("pending", env), "pending")
    assertStatus(run("finish", env), "success")
    for (const result of ["failure", "skipped", "cancelled", ""]) {
      assertStatus(run("finish", { ...env, CANDIDATE_RESULT: result }), "failure")
      assertStatus(run("finish", { ...env, INTEGRATION_RESULT: result }), "failure")
    }
  }
})

test("未確認のheadや不正な呼び出しではAPIへ送らない", (t) => {
  const run = fixture(t)
  for (const [phase, env] of [
    ["pending", { CONTEXT_HEAD: "", EXPECTED_HEAD: "" }],
    ["pending", { CONTEXT_HEAD: other }],
    ["pending", { GITHUB_EVENT_NAME: "workflow_dispatch" }],
    ["finish", { GITHUB_EVENT_NAME: "push" }],
    ["invalid", {}],
  ]) {
    const result = run(phase, env)
    assert.equal(result.status, 1, result.stderr)
    assert.doesNotMatch(result.stderr, /^POST$/m)
  }
})

test("投稿APIの失敗を呼び出し元に返す", (t) => {
  const result = fixture(t)("pending", { GH_EXIT: "1" })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /^POST$/m)
})

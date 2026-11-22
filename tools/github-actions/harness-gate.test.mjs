import assert from "node:assert/strict"
import test from "node:test"
import { resolveGate } from "./harness-gate.mjs"

const repo = "kosnu/savings"
const sha = "a".repeat(40)
const serverUrl = "https://github.com"
const successJobs = ["context", "candidate", "integration"].map((name) => ({
  name,
  conclusion: "success",
}))

function run(id, overrides = {}) {
  return {
    id,
    path: ".github/workflows/harness_checker_ci.yaml",
    repository: { full_name: repo },
    head_sha: sha,
    event: "pull_request",
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-23T00:00:00Z",
    ...overrides,
  }
}

function fixture(runs = [run(1)], jobs = new Map(), listedRuns = runs) {
  const calls = []
  const waits = []
  const gate = (triggerId = "1", onWait = () => {}) =>
    resolveGate({
      triggerId,
      repo,
      serverUrl,
      api(endpoint) {
        calls.push(endpoint)
        assert.ok(endpoint.startsWith(`repos/${repo}/actions/`))
        if (endpoint.endsWith(`/runs?head_sha=${sha}&per_page=100`)) {
          assert.ok(endpoint.includes("/workflows/harness_checker_ci.yaml/"))
          return { workflow_runs: listedRuns }
        }
        const match = endpoint.match(/\/runs\/([0-9]+)(\/jobs\?filter=latest&per_page=100)?$/)
        assert.ok(match, endpoint)
        const id = Number(match[1])
        return match[2] ? { jobs: jobs.get(id) ?? successJobs } : runs.find((item) => item.id === id)
      },
      async wait(ms) {
        waits.push(ms)
        onWait()
      },
    })
  return { calls, waits, gate }
}

function expected(state, id) {
  return {
    sha,
    status: {
      state,
      context: "harness-gate",
      description: `Harness CI: ${state} (run ${id})`,
      target_url: `${serverUrl}/${repo}/actions/runs/${id}`,
    },
  }
}

test("本文・タイトル編集のrunを除き、直前の有効runの状態を再投稿する", async () => {
  const edits = run(2, { conclusion: "skipped" })
  const jobs = new Map([[2, [{ name: "context", conclusion: "skipped" }]]])
  for (const [prior, state] of [
    [run(1, { status: "in_progress", conclusion: null }), "pending"],
    [run(1, { conclusion: "failure" }), "failure"],
  ]) {
    const f = fixture([prior, edits], jobs)
    assert.deepEqual(await f.gate("2"), expected(state, 1))
    assert.deepEqual(await f.gate(), expected(state, 1))
  }
})

test("古い成功通知でも最新runのpendingを投稿する", async () => {
  const f = fixture([run(1), run(2, { status: "in_progress", conclusion: null })])
  assert.deepEqual(await f.gate(), expected("pending", 2))
})

test("作成日時をrun IDより優先し、最新の失敗を投稿する", async () => {
  const f = fixture([run(9), run(1, { created_at: "2026-11-24T00:00:00Z", conclusion: "failure" })])
  assert.deepEqual(await f.gate("9"), expected("failure", 1))
})

test("botによるdispatchだけを採用候補・起動元として扱う", async () => {
  const f = fixture([
    run(1),
    run(2, { event: "workflow_dispatch", triggering_actor: { id: 41898282 } }),
    run(3, { event: "workflow_dispatch", triggering_actor: { id: 123 } }),
  ])
  assert.equal(await f.gate("3"), undefined)
  assert.deepEqual(await f.gate(), expected("success", 2))
})

test("forkのrunも自リポジトリの検証結果として投稿対象にする", async () => {
  const f = fixture([run(1, { head_repository: { full_name: "fork/savings" }, pull_requests: [] })])
  assert.deepEqual(await f.gate(), expected("success", 1))
})

test("不正なrun IDではAPIを呼ばない", async () => {
  const f = fixture()
  for (const id of ["", "0", "-1", "1/attempts/2", "1\n"]) {
    assert.equal(await f.gate(id), undefined)
  }
  assert.deepEqual(f.calls, [])
})

for (const overrides of [
  { path: ".github/workflows/other.yaml" },
  { repository: { full_name: "fork/savings" } },
  { head_sha: "invalid" },
  { event: "push" },
]) {
  test(`対象外のrunを無視する ${JSON.stringify(overrides)}`, async () => {
    const f = fixture([run(1, overrides)])
    assert.equal(await f.gate(), undefined)
    assert.equal(f.calls.length, 1)
  })
}

test("candidateとintegrationがskippedなら完了runは失敗になる", async () => {
  const jobs = successJobs.map((job) =>
    job.name === "context" ? job : { ...job, conclusion: "skipped" },
  )
  assert.deepEqual(await fixture([run(1)], new Map([[1, jobs]])).gate(), expected("failure", 1))
})

for (const conclusion of ["cancelled", "startup_failure"]) {
  test(`${conclusion}はcontextがスキップされても失敗になる`, async () => {
    const jobs = new Map([[1, [{ name: "context", conclusion: "skipped" }]]])
    assert.deepEqual(await fixture([run(1, { conclusion })], jobs).gate(), expected("failure", 1))
  })
}

test("requestedでcontextを再取得し、編集runと判明したら有効runの状態を再投稿する", async () => {
  const jobs = new Map([[2, []]])
  const f = fixture([run(1), run(2, { status: "queued", conclusion: null })], jobs)
  assert.deepEqual(
    await f.gate("2", () => jobs.set(2, [{ name: "context", conclusion: "skipped" }])),
    expected("success", 1),
  )
  assert.deepEqual(f.waits, [5000])
})

test("context判定がタイムアウトした編集runの完了通知で直前の成功を再投稿する", async () => {
  const edits = run(2, { status: "queued", conclusion: null })
  const jobs = new Map([[2, []]])
  const f = fixture([run(1), edits], jobs)
  assert.deepEqual(await f.gate("2"), expected("pending", 2))
  assert.equal(f.waits.reduce((total, ms) => total + ms, 0), 120000)

  edits.status = "completed"
  edits.conclusion = "skipped"
  jobs.set(2, [{ name: "context", conclusion: "skipped" }])
  assert.deepEqual(await f.gate("2"), expected("success", 1))
})

test("同じSHAに編集runしかない場合は投稿しない", async () => {
  const jobs = new Map([[1, [{ name: "context", conclusion: "skipped" }]]])
  const f = fixture([run(1, { conclusion: "skipped" })], jobs)
  assert.equal(await f.gate(), undefined)
})

test("一覧が前のattemptの成功でも、採用runの最新attemptの状態を使う", async () => {
  const latest = run(2, { run_attempt: 2, status: "in_progress", conclusion: null })
  const f = fixture([run(1), latest], new Map(), [run(1), run(2, { run_attempt: 1 })])
  assert.deepEqual(await f.gate(), expected("pending", 2))
})

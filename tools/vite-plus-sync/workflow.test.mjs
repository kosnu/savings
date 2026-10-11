import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"

const workflow = readFileSync(
  new URL("../../.github/workflows/vite_plus_sync.yaml", import.meta.url),
  "utf8",
)
function script(name) {
  const section = workflow.slice(workflow.indexOf(`      - name: ${name}`))
  return section.match(/script: \|\n((?: {12}.*\n|\n)+)/)[1].replace(/^ {12}/gm, "")
}
const route = script("Dispatch synchronization")
const validate = script("Validate Renovate")
const commit = script("Commit aligned")
const original = "a".repeat(40),
  synced = "b".repeat(40),
  base = "c".repeat(40)

function fixture() {
  const pr = {
    number: 1,
    state: "open",
    user: { id: 29139614, login: "renovate[bot]" },
    base: { ref: "main", sha: base },
    head: { sha: synced, ref: "renovate/vite-plus", repo: { full_name: "kosnu/savings" } },
  }
  const context = {
    repo: { owner: "kosnu", repo: "savings" },
    runId: 9,
    serverUrl: "https://github.com",
    sha: synced,
    ref: "refs/heads/renovate/vite-plus",
    payload: {
      sender: { id: 1 },
      pull_request: pr,
      inputs: { pr_number: "1", expected_head: synced },
    },
  }
  const signature = { verified: true, reason: "valid" }
  const commits = [
    {
      sha: original,
      author: { login: "renovate[bot]" },
      committer: { login: "web-flow" },
      commit: { verification: signature },
    },
    {
      sha: synced,
      author: { login: "github-actions[bot]", id: 41898282 },
      committer: { login: "web-flow" },
      parents: [{ sha: original }],
      commit: { message: "Vite-Plus-Sync-Run: 8", verification: { ...signature } },
    },
  ]
  const run = {
    path: ".github/workflows/vite_plus_sync.yaml",
    event: "workflow_dispatch",
    actor: { id: 41898282, login: "github-actions[bot]" },
    head_repository: { full_name: "kosnu/savings" },
    head_branch: pr.head.ref,
    head_sha: original,
  }
  const files = [{ filename: "pnpm-workspace.yaml", status: "modified" }]
  const calls = []
  const github = {
    paginate: async (method) => (method === "commits" ? commits : files),
    rest: {
      pulls: { get: async () => ({ data: pr }), listFiles: "files", listCommits: "commits" },
      actions: {
        getWorkflowRun: async () => ({ data: run }),
        createWorkflowDispatch: async (input) => calls.push(input),
      },
      repos: {
        getCommit: async () => ({ data: { files } }),
        createCommitStatus: async () => {},
        getContent: async ({ ref }) => ({
          data: {
            content: Buffer.from(
              `catalog:\n  vite-plus: ${ref === base ? "1.0.0" : "1.1.0"}\n`,
            ).toString("base64"),
          },
        }),
      },
    },
  }
  const core = {
    setOutput() {},
    summary: {
      addHeading() {
        return this
      },
      addRaw() {
        return this
      },
      async write() {},
    },
  }
  const execute = (source) =>
    vm.runInNewContext(`(async()=>{${source}})`, {
      github,
      context,
      core,
      Buffer,
      require: () => ({ execFileSync: () => "" }),
    })()
  return { execute, commits, run, files, calls }
}

test("同期追記を含むPRの人による再受付から、差分なしで同じSHAのCIへ進む", async () => {
  const f = fixture()
  await f.execute(route)
  assert.equal(f.calls[0].workflow_id, "vite_plus_sync.yaml")
  assert.equal(f.calls[0].inputs.expected_head, synced)
  await f.execute(validate)
  await f.execute(commit)
  assert.deepEqual(
    f.calls.slice(1).map((call) => [call.workflow_id, call.inputs.expected_head]),
    [
      ["frontend_ci.yaml", synced],
      ["aidd_checker_ci.yaml", synced],
    ],
  )
})

for (const [name, change] of [
  [
    "署名不正",
    (f) => {
      f.commits[1].commit.verification.verified = false
    },
  ],
  [
    "Bot名義の偽装",
    (f) => {
      f.commits[1].author.id = 1
    },
  ],
  [
    "run IDなし",
    (f) => {
      f.commits[1].commit.message = "sync"
    },
  ],
  [
    "親SHA不一致",
    (f) => {
      f.commits[1].parents[0].sha = base
    },
  ],
  [
    "別workflow",
    (f) => {
      f.run.path = ".github/workflows/other.yaml"
    },
  ],
  [
    "別イベント",
    (f) => {
      f.run.event = "push"
    },
  ],
  [
    "別実行者",
    (f) => {
      f.run.actor.id = 1
    },
  ],
  [
    "別repository",
    (f) => {
      f.run.head_repository.full_name = "other/repo"
    },
  ],
  [
    "別ブランチ",
    (f) => {
      f.run.head_branch = "main"
    },
  ],
  [
    "起点SHA不一致",
    (f) => {
      f.run.head_sha = base
    },
  ],
  [
    "ソース変更",
    (f) => {
      f.files[0].filename = "tools/vite-plus-sync/migrate.mjs"
    },
  ],
]) {
  test(`再受付で${String(name)}を拒否しCIを起動しない`, async () => {
    const f = fixture()
    change(f)
    await assert.rejects(f.execute(validate))
    assert.equal(f.calls.length, 0)
  })
}

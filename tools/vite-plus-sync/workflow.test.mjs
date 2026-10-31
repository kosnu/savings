import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
    base: { ref: "main", sha: base, repo: { full_name: "kosnu/savings" } },
    head: { sha: synced, ref: "renovate/vite-plus", repo: { full_name: "kosnu/savings" } },
  }
  const context = {
    repo: { owner: "kosnu", repo: "savings" },
    runId: 9,
    serverUrl: "https://github.com",
    sha: synced,
    ref: "refs/heads/renovate/vite-plus",
    payload: {
      action: "opened",
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
        createCommitStatus: async (input) => calls.push(input),
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
  return { execute, commits, run, files, calls, context, pr, github }
}

void test("同期追記を含むPRの再受付から、差分なしで同じSHAのCIへ進む", async () => {
  const f = fixture()
  await f.execute(route)
  const dispatches = () => f.calls.filter((call) => call.workflow_id)
  assert.equal(dispatches()[0].workflow_id, "vite_plus_sync.yaml")
  assert.equal(dispatches()[0].inputs.expected_head, synced)
  await f.execute(validate)
  await f.execute(commit)
  assert.deepEqual(
    dispatches()
      .slice(1)
      .map((call) => [call.workflow_id, call.inputs.expected_head]),
    [
      ["frontend_ci.yaml", synced],
      ["harness_checker_ci.yaml", synced],
    ],
  )
  assert.ok(dispatches().every((call) => call.ref === f.pr.head.ref))
})

function concurrencyGroup(payload, runId = 9) {
  const group = workflow.match(/^  group: (.+)$/m)[1]
  return group.replace(/\$\{\{(.*?)\}\}/g, (_, expression) =>
    vm.runInNewContext(expression, {
      github: {
        event: { ...payload, changes: { base: {}, ...payload.changes } },
        run_id: runId,
      },
      inputs: {},
      format: (template, value) => template.replace("{0}", value),
    }),
  )
}

for (const field of ["body", "title"]) {
  void test(`${field}のみの編集はAPI・status・dispatchを呼ばず、検証受付と競合しない`, async () => {
    const f = fixture()
    const validationGroup = concurrencyGroup(f.context.payload)
    f.context.payload.action = "edited"
    f.context.payload.changes = { [field]: { from: "previous" } }
    f.github.rest.pulls.get = () => assert.fail("metadata edit must not fetch PR")
    await f.execute(route)
    assert.deepEqual(f.calls, [])
    assert.notEqual(concurrencyGroup(f.context.payload), validationGroup)
    assert.notEqual(concurrencyGroup(f.context.payload, 10), concurrencyGroup(f.context.payload))
  })
}

for (const action of ["opened", "reopened", "synchronize", "edited"]) {
  void test(`${action}の通常PRは同期受付からCIをdispatchしない`, async () => {
    const f = fixture()
    f.pr.user = { id: 1, login: "human" }
    f.files[0].filename = ".github/workflows/vite_plus_sync.yaml"
    f.context.payload.action = action
    if (action === "edited") {
      f.context.payload.changes = { base: { ref: { from: "release" }, sha: { from: original } } }
    }
    await f.execute(route)
    assert.deepEqual(f.calls, [])
    assert.equal(concurrencyGroup(f.context.payload), "vite-plus-sync-1")
  })
}

const harness = readFileSync(
  new URL("../../.github/workflows/harness_checker_ci.yaml", import.meta.url),
  "utf8",
)
function shellStep(name, source = harness) {
  return source
    .slice(source.indexOf(`      - name: ${name}`))
    .match(/run: \|\n((?: {10}.*\n|\n)+)/)[1]
    .replace(/^ {10}/gm, "")
}
// group式の評価で旧受付との競合を検出する。Actionsの待機・取消処理そのものは再現しない。
void test("Checkerは旧受付・別イベント・別PRと競合せず、同じPRイベントの再実行だけを置き換える", () => {
  const expression = harness.match(/^  group: (.+)$/m)[1]
  const group = (eventName, number, runId = 9) =>
    expression.replace(/\$\{\{(.*?)\}\}/g, (_, value) =>
      vm.runInNewContext(value, {
        github: {
          event_name: eventName,
          event: { pull_request: { number: eventName === "pull_request" ? number : undefined } },
          run_id: runId,
        },
        inputs: eventName === "workflow_dispatch" ? { pr_number: String(number) } : {},
      }),
    )
  const direct = group("pull_request", 2022)
  const dispatched = group("workflow_dispatch", 2022)
  const legacy = "aidd-checker-2022"
  assert.notEqual(direct, legacy)
  assert.notEqual(dispatched, legacy)
  assert.notEqual(direct, dispatched)
  for (const eventName of ["pull_request", "workflow_dispatch"]) {
    assert.equal(group(eventName, 2022, 9), group(eventName, 2022, 10))
    assert.notEqual(group(eventName, 2022), group(eventName, 2023))
  }
  assert.match(harness, /cancel-in-progress: true/)
})

const aggregate = shellStep("Require candidate and integration success")
const report = shellStep("Report dispatched CI on the PR commit")

for (const job of ["context", "candidate", "integration", "verify"]) {
  for (const result of ["success", "failure", "cancelled", "skipped"]) {
    void test(`Harness ${job}=${result}の集約・投稿は未完了を成功にしない`, () => {
      const needs = Object.fromEntries(
        ["context", "candidate", "integration", "verify"].map((name) => [
          name,
          { result: name === job ? result : "success" },
        ]),
      )
      const env = {
        ...process.env,
        EXPECTED_HEAD: synced,
        CONTEXT_HEAD: synced,
        GITHUB_REF: "refs/heads/renovate/vite-plus",
        GITHUB_SHA: synced,
        GITHUB_REPOSITORY: "kosnu/savings",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_RUN_ID: "9",
        JOB_RESULTS: JSON.stringify(needs),
        CANDIDATE_RESULT: needs.candidate.result,
        INTEGRATION_RESULT: needs.integration.result,
      }
      const verified = spawnSync("bash", ["-e", "-c", aggregate], { env })
      assert.equal(
        verified.status === 0,
        needs.candidate.result === "success" && needs.integration.result === "success",
      )
      const posted = spawnSync("bash", ["-c", `gh() { printf '%s\\n' "$@"; }\n${report}`], {
        env,
        encoding: "utf8",
      })
      assert.equal(posted.status, result === "success" ? 0 : 1, posted.stderr)
      assert.match(
        posted.stdout,
        new RegExp(`state=${result === "success" ? "success" : "failure"}`),
      )
      assert.match(posted.stdout, new RegExp(`statuses/${synced}`))
    })
  }
}

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
  void test(`再受付で${String(name)}を拒否しCIを起動しない`, async () => {
    const f = fixture()
    change(f)
    await assert.rejects(f.execute(validate))
    assert.equal(f.calls.length, 0)
  })
}

for (const name of ["frontend_ci.yaml", "harness_checker_ci.yaml"]) {
  const yaml = readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")
  const resolve = shellStep("Resolve and validate PR context", yaml)
  void test(`${name}はPRを直接購読し、同期後dispatchの結果だけを別jobで投稿する`, () => {
    assert.match(yaml, /on:\n  pull_request:\n/)
    assert.doesNotMatch(yaml, /pull_request_target/)
    assert.match(
      yaml,
      /INPUT_PR: \$\{\{ github.event.pull_request.number \|\| inputs.pr_number \}\}/,
    )
    assert.match(
      yaml,
      /EXPECTED_HEAD: \$\{\{ github.event.pull_request.head.sha \|\| inputs.expected_head \}\}/,
    )
    assert.match(
      yaml,
      /report-dispatched-result:\n    if: always\(\) && github.event_name == 'workflow_dispatch'/,
    )
    assert.doesNotMatch(
      yaml.split("\n  report-dispatched-result:")[0],
      /(?:contents|statuses|actions|pull-requests): write|secrets\./,
    )
    assert.match(yaml, /types: \[opened, synchronize, reopened, edited\]/)
  })
  for (const event of ["pull_request", "workflow_dispatch"]) {
    for (const fork of [false, true]) {
      void test(`${name}の${event}は${fork ? "fork" : "同一repo"}の現在headを検証し、古いheadを拒否する`, () => {
        const f = fixture()
        if (fork) f.pr.head.repo.full_name = "fork/savings"
        const dir = mkdtempSync(join(tmpdir(), "pr-ci-context-"))
        try {
          const env = {
            ...process.env,
            GITHUB_EVENT_NAME: event,
            GITHUB_SHA: event === "pull_request" ? "d".repeat(40) : synced,
            GITHUB_REF:
              event === "pull_request" ? "refs/pull/1/merge" : "refs/heads/renovate/vite-plus",
            GITHUB_REPOSITORY: "kosnu/savings",
            INPUT_PR: "1",
            EXPECTED_HEAD: synced,
            SYNC_RUN_ID: event === "workflow_dispatch" ? "9" : "",
            RUNNER_TEMP: dir,
            GITHUB_OUTPUT: join(dir, "output"),
            PR_FIXTURE: JSON.stringify(f.pr),
          }
          const run = (changes) =>
            spawnSync("bash", ["-c", `gh() { printf '%s' "$PR_FIXTURE"; }\n${resolve}`], {
              env: { ...env, ...changes },
              encoding: "utf8",
            })
          const accepted = run({})
          assert.equal(accepted.status, 0, accepted.stderr)
          assert.match(readFileSync(env.GITHUB_OUTPUT, "utf8"), new RegExp(`head=${synced}`))
          assert.notEqual(run({ EXPECTED_HEAD: original }).status, 0)
          assert.notEqual(
            run({ PR_FIXTURE: JSON.stringify({ ...f.pr, state: "closed" }) }).status,
            0,
          )
          assert.notEqual(
            run({ PR_FIXTURE: JSON.stringify({ ...f.pr, base: { ...f.pr.base, ref: "release" } }) })
              .status,
            0,
          )
          if (event === "workflow_dispatch") {
            assert.notEqual(run({ GITHUB_SHA: original }).status, 0)
            assert.notEqual(run({ SYNC_RUN_ID: "" }).status, 0)
          }
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      })
    }
  }
}

void test("同期受付は同一repoのRenovate PRだけをpull_requestで受け付ける", async () => {
  assert.match(workflow, /on:\n  pull_request:/)
  assert.doesNotMatch(workflow, /pull_request_target/)
  const job = workflow.split("\n  route:\n")[1].split("\n  sync:\n")[0]
  assert.match(job, /github.event.pull_request.head.repo.full_name == github.repository/)
  assert.match(job, /github.event.pull_request.user.id == 29139614/)
  assert.doesNotMatch(job, /statuses: write/)
  for (const mutate of [
    (f) => {
      f.pr.head.repo.full_name = "fork/savings"
    },
    (f) => {
      f.pr.user = { id: 1, login: "renovate[bot]" }
    },
    (f) => {
      f.files[0].filename = ".github/workflows/vite_plus_sync.yaml"
    },
    (f) => {
      f.github.rest.repos.getContent = async () => ({
        data: { content: Buffer.from("  vite-plus: 1.0.0\n").toString("base64") },
      })
    },
  ]) {
    const f = fixture()
    mutate(f)
    await f.execute(route)
    assert.deepEqual(f.calls, [])
  }
})

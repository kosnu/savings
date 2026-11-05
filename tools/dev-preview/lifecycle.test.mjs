import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { reconcilePR, resolveLifecycle } from "./lifecycle.mjs"

const repo = "kosnu/savings"
const sha = "a".repeat(40)
const env = {
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_REF: "refs/pull/1927/merge",
  GITHUB_REPOSITORY: repo,
}
const pr = {
  state: "open",
  head: { ref: "feature/preview", sha, repo: { full_name: repo } },
  base: { ref: "main" },
  labels: [{ name: "preview" }],
}
const event = { number: 1927, action: "labeled", label: { name: "preview" }, pull_request: pr }
const closedEnv = {
  ...env,
  GITHUB_EVENT_NAME: "pull_request_target",
  GITHUB_REF: "refs/heads/main",
}
const get = (value) => async (path) => {
  assert.equal(path, `/repos/${repo}/pulls/1927`)
  return structuredClone(value)
}

// PR取得はfixture。配信・削除を実行せず、後続処理へ渡す判定と対象を検査する。
test("信頼済み受付は event SHA を固定し、open PR の要求に deploy=true を返す", async () => {
  assert.deepEqual(await resolveLifecycle(event, env, get(pr)), {
    number: "1927",
    branch: pr.head.ref,
    sha,
    deploy: true,
  })
  for (const patch of [
    { head: { ...pr.head, sha: "b".repeat(40) } },
    { head: { ...pr.head, ref: "feature/renamed" } },
    { labels: [] },
  ]) {
    await assert.rejects(resolveLifecycle(event, env, get({ ...pr, ...patch })))
  }
})

test("競合close・mergeはtargetで削除対象を解決し、古いlabel要求も配信しない", async () => {
  for (const closed of [
    { ...pr, state: "closed", merged: false, mergeable: false },
    { ...pr, state: "closed", merged: false, mergeable: true },
    { ...pr, state: "closed", merged: true },
  ]) {
    for (const [action, context] of [
      ["closed", closedEnv],
      ["labeled", env],
    ]) {
      const result = await resolveLifecycle(
        { ...event, action, pull_request: closed },
        context,
        get(closed),
      )
      assert.equal(result.deploy, false)
      assert.equal(result.branch, pr.head.ref)
      assert.equal(result.number, "1927")
      assert.deepEqual(await reconcilePR({ ...context, PR_NUMBER: result.number }, get(closed)), {
        closed: true,
      })
    }
  }
  // 終了通知が待機中に reopen されたら旧 close event は配信の権限にならない。
  const reopened = await resolveLifecycle({ ...event, action: "closed" }, closedEnv, get(pr))
  assert.equal(reopened.deploy, false)
  assert.deepEqual(await reconcilePR({ ...closedEnv, PR_NUMBER: reopened.number }, get(pr)), {
    closed: false,
  })
})

test("main 手動実行は現在 SHA を解決し、closedなら配信しない", async () => {
  const manual = { inputs: { pr_number: "1927" } }
  const context = { ...env, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" }
  assert.equal((await resolveLifecycle(manual, context, get(pr))).sha, sha)
  assert.equal(
    (await resolveLifecycle(manual, context, get({ ...pr, state: "closed" }))).deploy,
    false,
  )
  await assert.rejects(
    resolveLifecycle(manual, { ...context, GITHUB_REF: "refs/heads/untrusted" }, get(pr)),
  )
})

test("fork・別base・別label・未対応event・出力注入を信頼済み受付で拒否", async () => {
  for (const invalid of [
    { ...event, number: "1927\nbranch=main" },
    { ...event, action: "synchronize" },
    { ...event, label: { name: "other" } },
    { ...event, pull_request: { ...pr, base: { ref: "release" } } },
    {
      ...event,
      pull_request: { ...pr, head: { ...pr.head, repo: { full_name: "fork/savings" } } },
    },
    { ...event, pull_request: { ...pr, head: { ...pr.head, ref: "bad\nbranch" } } },
  ])
    await assert.rejects(resolveLifecycle(invalid, env, get(pr)))
  await assert.rejects(resolveLifecycle(event, closedEnv, get(pr)))
  await assert.rejects(resolveLifecycle({ ...event, action: "closed" }, env, get(pr)))
  for (const context of [env, closedEnv]) {
    const fork = { ...pr, head: { ...pr.head, repo: { full_name: "fork/savings" } } }
    const action = context === env ? "labeled" : "closed"
    await assert.rejects(
      resolveLifecycle({ ...event, action, pull_request: fork }, context, get(pr)),
    )
    await assert.rejects(resolveLifecycle({ ...event, action }, context, get(fork)))
  }
  await assert.rejects(
    resolveLifecycle(event, env, async () => {
      throw new Error("GitHub unavailable")
    }),
  )
})

// workflow 本文の接続・権限の静的検査。Actions の解釈・実配信・削除は再現しない。
test("配信はPR要求、削除は同じPRの終了通知と配信後確認から起動する", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  const deploy = yaml.split("\n  deploy-web:\n")[1].split("\n  cleanup:\n")[0]
  const cleanup = yaml.split("\n  cleanup:\n")[1].split("\n  report:\n")[0]
  assert.match(yaml, /pull_request:\n    branches: \[main\]\n    types: \[labeled\]/u)
  assert.match(yaml, /pull_request_target:[^\n]*\n    branches: \[main\]\n    types: \[closed\]/u)
  assert.match(
    deploy,
    /github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main'/u,
  )
  assert.match(deploy, /github.event_name == 'pull_request' && github.event.action == 'labeled'/u)
  assert.match(deploy, /github.event.label.name == 'preview'/u)
  assert.doesNotMatch(deploy, /github.event_name == 'pull_request_target'|needs.resolve/u)
  for (const job of [deploy, cleanup]) {
    assert.match(job, /github.event.pull_request.head.repo.full_name == github.repository/u)
    assert.match(job, /github.event.pull_request.base.ref == 'main'/u)
  }
  assert.match(
    yaml,
    /group: dev-preview-pr-\$\{\{ github.event.pull_request.number \|\| inputs.pr_number \}\}/u,
  )
  assert.match(yaml, /cancel-in-progress: false/u)
  assert.match(cleanup, /needs: deploy-web/u)
  assert.match(cleanup, /always\(\) &&/u)
  assert.match(cleanup, /needs.deploy-web.result != 'skipped'/u)
  assert.match(
    cleanup,
    /github.event_name == 'pull_request_target' && github.event.action == 'closed'/u,
  )
  assert.match(cleanup, /ref: \$\{\{ github.event.pull_request.base.sha \|\| github.sha \}\}/u)
  assert.match(cleanup, /persist-credentials: false/u)
  assert.match(cleanup, /run: node tools\/dev-preview\/lifecycle.mjs reconcile/u)
  assert.match(cleanup, /if: steps.state.outputs.closed == 'true'/u)
  assert.match(cleanup, /environment: development/u)
  assert.match(cleanup, /PREVIEW_BRANCH: \$\{\{ github.event.pull_request.head.ref \}\}/u)
  assert.match(cleanup, /gh api "repos\/\$GITHUB_REPOSITORY\/pulls\/\$PR_NUMBER" --jq '.head.ref'/u)
  assert.doesNotMatch(cleanup, /needs.deploy-web.outputs|pnpm|npm|uses:.*\.\//u)
  assert.doesNotMatch(cleanup, /SUPABASE|VITE_|statuses: write|pull-requests: write/u)
  assert.match(yaml.split("\n  report:\n")[1], /if: needs.cleanup.outputs.closed == 'false'/u)
})

test("Prodを基準とする配信jobはPR確認・checkout・build・検査・配信を順に実行する", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  const deploy = yaml.split("\n  deploy-web:\n")[1].split("\n  cleanup:\n")[0]
  const steps = [
    "Resolve selected PR head",
    "Preserve trusted Preview helpers",
    "Checkout validated commit",
    "Setup pnpm",
    "Setup Node.js",
    "Install dependencies",
    "Build Dev Preview",
    "Validate Workers Static Assets",
    "Deploy Dev Preview",
  ].map((name) => deploy.indexOf(`- name: ${name}\n`))
  assert.ok(
    steps.every((position, index) => position >= 0 && (index === 0 || position > steps[index - 1])),
  )
  assert.match(
    deploy,
    /cp tools\/dev-preview\/preview.mjs tools\/dev-preview\/report.mjs "\$RUNNER_TEMP\/preview-control\/"/u,
  )
  assert.match(deploy, /node "\$RUNNER_TEMP\/preview-control\/preview.mjs" check-build/u)
  assert.match(
    deploy,
    /node "\$RUNNER_TEMP\/preview-control\/report.mjs" "\$RUNNER_TEMP\/preview.json"/u,
  )
})

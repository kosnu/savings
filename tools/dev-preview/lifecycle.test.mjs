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

// workflow本文の静的検査。Actionsの直列化や削除jobの実行は再現しない。
test("workflow 本文は非cancel groupとmainコードを使う受付・後処理・削除jobを定義する", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  const resolve = yaml.split("\n  resolve:\n")[1].split("\n  deploy:\n")[0]
  const reconcile = yaml.split("\n  reconcile:\n")[1].split("\n  cleanup:\n")[0]
  const cleanup = yaml.split("\n  cleanup:\n")[1].split("\n  report:\n")[0]
  // 配信と終了の入口を固定し、競合PRで配送されないpull_requestへの後退を検知する。
  assert.match(yaml, /pull_request:\n    branches: \[main\]\n    types: \[labeled\]/u)
  assert.match(yaml, /pull_request_target:[^\n]*\n    branches: \[main\]\n    types: \[closed\]/u)
  assert.match(
    resolve,
    /github.event_name == 'pull_request_target' && github.event.action == 'closed'/u,
  )
  assert.match(resolve, /github.event.pull_request.head.repo.full_name == github.repository/u)
  assert.match(resolve, /github.event.pull_request.base.ref == 'main'/u)
  assert.match(
    yaml,
    /group: dev-preview-pr-\$\{\{ github.event.pull_request.number \|\| inputs.pr_number \}\}/u,
  )
  assert.match(yaml, /cancel-in-progress: false/u)
  assert.match(
    yaml,
    /if: github.event_name != 'pull_request_target' && needs.resolve.outputs.deploy == 'true'/u,
  )
  for (const job of [resolve, reconcile, cleanup]) {
    assert.match(job, /ref: \$\{\{ github.event.pull_request.base.sha \|\| github.sha \}\}/u)
    assert.doesNotMatch(job, /head.sha|ref:.*needs.resolve.outputs.sha|pnpm|npm|uses:.*\.\//u)
    assert.match(job, /persist-credentials: false/u)
  }
  assert.match(reconcile, /needs: \[resolve, deploy\]/u)
  assert.match(reconcile, /if: always\(\) && needs.resolve.result == 'success'/u)
  assert.match(cleanup, /if: always\(\) && needs.reconcile.outputs.closed == 'true'/u)
  assert.match(cleanup, /environment: development/u)
  assert.match(cleanup, /PREVIEW_BRANCH: \$\{\{ needs.resolve.outputs.branch \}\}/u)
  assert.doesNotMatch(
    cleanup,
    /needs.deploy.outputs|SUPABASE|VITE_|statuses: write|pull-requests: write/u,
  )
  assert.match(yaml, /preview.mjs" name "\$PREVIEW_BRANCH" "\$PR_NUMBER"/u)
  assert.match(yaml.split("\n  report:\n")[1], /if: needs.reconcile.outputs.closed == 'false'/u)
})

test("配信job本文はPR checkout前のmain補助コードの退避と利用を指定する", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  const deploy = yaml.split("\n  deploy:\n")[1].split("\n  reconcile:\n")[0]
  assert.ok(
    deploy.indexOf("Revalidate after environment approval") <
      deploy.indexOf("Checkout approved commit"),
  )
  assert.ok(
    deploy.indexOf("Preserve trusted Preview helpers") < deploy.indexOf("Checkout approved commit"),
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

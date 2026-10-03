import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { authorize, deploymentRequest } from "./authorize.mjs"

const repo = "kosnu/savings"
const sha = "a".repeat(40)
const label = "preview"
function fixture() {
  const pr = {
    state: "open",
    base: { ref: "main" },
    head: { ref: "feature/example", sha, repo: { full_name: repo } },
    labels: [{ name: label }],
  }
  return {
    event: { action: "labeled", number: 1871, label: { name: label }, pull_request: pr },
    pr,
  }
}
const request = { number: "1871", sha, labeled: true, kind: "preview" }
const getter = (f) => async () => f.pr

test("PR label resolves the immutable event head; dispatch remains main-only", () => {
  const f = fixture()
  assert.deepEqual(
    deploymentRequest(f.event, "pull_request", "refs/pull/1871/merge", repo),
    request,
  )
  const event = { inputs: { pr_number: "1871", head_sha: sha } }
  assert.deepEqual(deploymentRequest(event, "workflow_dispatch", "refs/heads/main", repo), {
    ...request,
    labeled: false,
  })
  assert.throws(() => deploymentRequest(event, "workflow_dispatch", "refs/heads/feature", repo))
})

test("updates, unrelated labels, forks, wrong base and unsupported events cannot opt in", () => {
  for (const mutate of [
    (f) => {
      f.event.action = "synchronize"
    },
    (f) => {
      f.event.label.name = "other"
    },
    (f) => {
      f.event.label.name = `preview:${"b".repeat(40)}`
    },
    (f) => {
      f.pr.head.repo.full_name = "fork/savings"
    },
    (f) => {
      f.pr.base.ref = "release"
    },
    (f) => {
      f.event.number = "1\nsha=bad"
    },
  ]) {
    const f = fixture()
    mutate(f)
    assert.throws(() => deploymentRequest(f.event, "pull_request", "refs/pull/1871/merge", repo))
  }
  assert.throws(() =>
    deploymentRequest(fixture().event, "pull_request_target", "refs/heads/main", repo),
  )
})

test("the selected head resolves without an Environment API dependency", async () => {
  assert.deepEqual(await authorize(request, repo, getter(fixture())), {
    branch: "feature/example",
    sha,
  })
})

test("head races, withdrawal, closure and foreign PRs fail the post-approval recheck", async () => {
  await assert.rejects(
    authorize({ ...request, branch: "feature/renamed" }, repo, getter(fixture())),
  )
  for (const mutate of [
    (f) => {
      f.pr.head.sha = "b".repeat(40)
    },
    (f) => {
      f.pr.labels = []
    },
    (f) => {
      f.pr.state = "closed"
    },
    (f) => {
      f.pr.head.repo = null
    },
    (f) => {
      f.pr.base.ref = "release"
    },
    (f) => {
      f.pr.head.ref = "feature\nsha=injected"
    },
  ]) {
    const f = fixture()
    mutate(f)
    await assert.rejects(authorize(request, repo, getter(f)))
  }
})

test("workflow limits triggers and gates installation/deployment behind environment and revalidation", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  assert.match(yaml, /pull_request:\n    branches: \[main\]\n    types: \[labeled\]/)
  assert.doesNotMatch(yaml, /pull_request_target:|types:.*synchronize|secrets: inherit/)
  assert.match(yaml, /environment: development/)
  assert.match(yaml, /ref: \$\{\{ needs.resolve.outputs.sha \}\}/)
  assert.equal(yaml.match(/run: node tools\/dev-preview\/authorize.mjs/g)?.length, 2)
  assert.ok(yaml.indexOf("Revalidate after environment approval") < yaml.indexOf("run: pnpm ci"))
  assert.ok(yaml.indexOf("run: pnpm ci") < yaml.indexOf("secrets.CLOUDFLARE_API_TOKEN"))
})

test("database requests use their own label and the same immutable head checks", async () => {
  const f = fixture()
  f.event.label.name = "dev-db"
  f.pr.labels = [{ name: "dev-db" }]
  const db = deploymentRequest(f.event, "pull_request", "refs/pull/1871/merge", repo, "database")
  assert.equal(db.kind, "database")
  assert.deepEqual(await authorize(db, repo, getter(f)), { branch: f.pr.head.ref, sha })
  f.pr.head.sha = "b".repeat(40)
  await assert.rejects(authorize(db, repo, getter(f)))
  f.event.label.name = "preview"
  assert.throws(() =>
    deploymentRequest(f.event, "pull_request", "refs/pull/1871/merge", repo, "database"),
  )
})

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
  assert.throws(() =>
    deploymentRequest(
      { ...fixture().event, action: "closed" },
      "pull_request_target",
      "refs/heads/main",
      repo,
    ),
  )
})

// PR取得はfixture。GitHubの実APIやEnvironment承認は実行しない。
test("authorize returns the branch and SHA of the selected open PR", async () => {
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

// 以下のworkflow検査は本文の接続・条件・順序を固定する。Actionsの解釈や実行結果は確認しない。
test("workflow text declares allowed triggers, environment and revalidation before installation", () => {
  const yaml = readFileSync(
    new URL("../../.github/workflows/deploy_preview.yaml", import.meta.url),
    "utf8",
  )
  assert.match(yaml, /pull_request:\n    branches: \[main\]\n    types: \[labeled\]/)
  assert.match(yaml, /pull_request_target:[^\n]*\n    branches: \[main\]\n    types: \[closed\]/)
  assert.doesNotMatch(yaml, /types:.*synchronize|secrets: inherit/)
  assert.match(yaml, /environment: development/)
  assert.match(yaml, /ref: \$\{\{ needs.resolve.outputs.sha \}\}/)
  assert.equal(yaml.match(/run: node tools\/dev-preview\/authorize.mjs/g)?.length, 1)
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

test("workflow text separates FE/DB secret references and connects checkout SHA to SENTRY_RELEASE", () => {
  const read = (name) =>
    readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")
  const frontend = read("deploy_preview.yaml")
  const database = read("deploy_dev_database.yaml")
  const secrets = (yaml) =>
    [...new Set([...yaml.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1]))].sort((a, b) =>
      a.localeCompare(b),
    )
  for (const yaml of [frontend, database]) {
    assert.match(yaml, /^    environment: development$/m)
  }
  assert.deepEqual(secrets(frontend), [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "VITE_SENTRY_DSN",
    "VITE_SENTRY_ENVIRONMENT",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
  ])
  assert.deepEqual(secrets(database), ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"])
  const production = read("deploy_production.yaml")
  const previewBuild = frontend
    .split("      - name: Build Dev Preview\n")[1]
    .split("      - name: Deploy Dev Preview\n")[0]
  const productionWeb = production.split("\n  deploy-web:\n")[1]
  for (const [workflow, build, source] of [
    [frontend, previewBuild, "needs.resolve.outputs.sha"],
    [productionWeb, productionWeb, "github.sha"],
  ]) {
    assert.ok(workflow.includes(`ref: \${{ ${source} }}`))
    assert.ok(build.includes(`SENTRY_RELEASE: \${{ ${source} }}`))
    const guard = build.indexOf(': "${SENTRY_RELEASE:?SENTRY_RELEASE が必要です}"')
    assert.ok(guard >= 0 && guard < build.indexOf("pnpm run web:build"))
  }
  for (const key of [
    "VITE_SENTRY_DSN",
    "VITE_SENTRY_ENVIRONMENT",
    "SENTRY_AUTH_TOKEN",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
  ]) {
    const reference = key + ": ${{ secrets." + key + " }}"
    for (const yaml of [frontend, production]) {
      assert.ok(yaml.includes(reference), `${key} must use the same Environment Secret source`)
      assert.ok(yaml.includes(`\${${key}:?${key} が必要です}`), `${key} must fail when empty`)
    }
  }
  const ci = read("dev_preview_ci.yaml")
  assert.match(ci, /VITE_SENTRY_DSN: https:\/\/public@sentry\.invalid\/1/)
  assert.match(ci, /VITE_SENTRY_ENVIRONMENT: development/)
  assert.doesNotMatch(ci, /secrets\.|SENTRY_AUTH_TOKEN/)
  assert.match(database, /^  group: burneto-shared-dev-database$/m)
  assert.ok(
    database.indexOf("Revalidate after migration approval") <
      database.indexOf("secrets.SUPABASE_ACCESS_TOKEN"),
  )
})

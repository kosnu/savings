import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { authorize, deploymentRequest } from "../dev-preview/authorize.mjs"
import {
  databaseConnection,
  DEV_PROJECT_REF,
  executePlan,
  migrationPlan,
  sqlFingerprint,
} from "./migrations.mjs"

const a = { version: "20260101000000", name: "first", sql: "create table demo(id int);" }
const b = { version: "20260102000000", name: "next", sql: "alter table demo add column name text;" }
const applied = (m) => ({ version: m.version, name: m.name, statements: [m.sql] })

test("SQL evidence matches MCP and CLI forms but preserves literals and function bodies", () => {
  assert.equal(
    sqlFingerprint("-- note\nSELECT 1; /* nested /* ok */ comment */ select 2;"),
    sqlFingerprint("select 1;\nselect 2"),
  )
  assert.notEqual(sqlFingerprint("select 'a b'"), sqlFingerprint("select 'ab'"))
  assert.notEqual(sqlFingerprint("select $$a; --b$$"), sqlFingerprint("select $$a; --c$$"))
  assert.notEqual(sqlFingerprint('select "User"'), sqlFingerprint('select "user"'))
  for (const sql of ["select 'unterminated", "/* bad", "select $f$bad"])
    assert.throws(() => sqlFingerprint(sql))
})

test("history must be an unchanged ordered prefix; branch conflicts fail closed", () => {
  assert.equal(migrationPlan([a, b], [applied(a)]).pending[0].version, b.version)
  for (const remote of [
    [applied(b)],
    [applied(a), applied(b), { ...applied(b), version: "20260103000000" }],
    [{ ...applied(a), name: "renamed" }],
    [{ ...applied(a), statements: ["create table other(id int)"] }],
    [{ ...applied(a), statements: [] }],
    [applied(a), applied(a)],
  ])
    assert.throws(() => migrationPlan([a, b], remote))
  assert.throws(() => migrationPlan([a, { ...b, version: a.version }], []))
})

test("plan performs no writes; apply refuses history/source drift after owner approval", async () => {
  let writes = 0
  const args = {
    local: [a, b],
    readHistory: async () => [applied(a)],
    push: async () => {
      writes++
    },
  }
  const plan = await executePlan({ ...args, apply: false })
  assert.equal(writes, 0)
  await assert.rejects(executePlan({ ...args, apply: true, expectedDigest: "stale" }), /changed/)
  await assert.rejects(
    executePlan({
      ...args,
      apply: true,
      expectedDigest: plan.digest,
      readHistory: async () => [applied(a), applied(b)],
    }),
    /changed/,
  )
  assert.equal(writes, 0)
})

test("apply verifies remote history; repeat is no-op; partial failure is not repaired", async () => {
  let history = [applied(a)]
  let writes = 0
  const plan = migrationPlan([a, b], history)
  const args = {
    local: [a, b],
    readHistory: async () => history,
    push: async () => {
      writes++
      history.push(applied(b))
    },
    apply: true,
    expectedDigest: plan.digest,
  }
  const done = await executePlan(args)
  assert.equal(done.pending.length, 0)
  assert.equal(writes, 1)
  await executePlan({ ...args, expectedDigest: done.digest })
  assert.equal(writes, 1)
  await assert.rejects(
    executePlan({
      ...args,
      readHistory: async () => [applied(a)],
      push: async () => {},
      expectedDigest: plan.digest,
    }),
    /incomplete/,
  )
})

test("only the fixed Dev project and direct/session host can receive existing DB credentials", () => {
  const env = {
    DEV_SUPABASE_PROJECT_REF: DEV_PROJECT_REF,
    DEV_DB_HOST: "aws-1-ap-northeast-1.pooler.supabase.com",
    DEV_SUPABASE_DB_PASSWORD: "fixture",
    DEV_DB_SSL_ROOT_CERT: "-----BEGIN CERTIFICATE-----\nfixture",
  }
  assert.equal(databaseConnection(env).user, `postgres.${DEV_PROJECT_REF}`)
  assert.equal(
    databaseConnection({ ...env, DEV_DB_HOST: `db.${DEV_PROJECT_REF}.supabase.co` }).user,
    "postgres",
  )
  for (const overrides of [
    { DEV_SUPABASE_PROJECT_REF: "izuzqvgvgquqqimwuygw" },
    { DEV_DB_HOST: "db.izuzqvgvgquqqimwuygw.supabase.co" },
    { DEV_DB_HOST: "evil.example" },
    { DEV_DB_HOST: "aws-1-ap-northeast-1.pooler.supabase.com:6543" },
    { DEV_SUPABASE_DB_PASSWORD: "" },
    { DEV_DB_SSL_ROOT_CERT: "" },
  ])
    assert.throws(() => databaseConnection({ ...env, ...overrides }))
})

test("PR-only UX pins the event head internally and database credentials require their own owner gate", async () => {
  const sha = "a".repeat(40)
  const pr = {
    state: "open",
    base: { ref: "main" },
    head: { sha, ref: "feature/new-table", repo: { full_name: "kosnu/savings" } },
    labels: [{ name: "dev-db" }],
  }
  const request = deploymentRequest(
    { action: "labeled", number: 1871, label: { name: "dev-db" }, pull_request: pr },
    "pull_request",
    "refs/pull/1871/merge",
    "kosnu/savings",
    "database",
  )
  assert.equal(request.sha, sha)
  const get = async (path) =>
    path.includes("/environments/")
      ? {
          name: "development-database",
          protection_rules: [
            {
              type: "required_reviewers",
              prevent_self_review: false,
              reviewers: [{ type: "User", reviewer: { login: "kosnu" } }],
            },
          ],
        }
      : pr
  assert.deepEqual(await authorize(request, "kosnu/savings", get), { sha, branch: pr.head.ref })
  await assert.rejects(
    authorize(request, "kosnu/savings", async (path) =>
      path.includes("/environments/") ? { name: "development", protection_rules: [] } : pr,
    ),
  )
  await assert.rejects(
    authorize(request, "kosnu/savings", async (path) =>
      path.includes("/pulls/") ? { ...pr, head: { ...pr.head, sha: "b".repeat(40) } } : get(path),
    ),
  )
})

test("current 23-migration checkpoint plans the remaining 13 and exposes destructive review", () => {
  const local = readdirSync("apps/api/supabase/migrations")
    .sort()
    .map((f) => ({
      version: f.slice(0, 14),
      name: f.slice(15, -4),
      sql: readFileSync(`apps/api/supabase/migrations/${f}`, "utf8"),
    }))
  const plan = migrationPlan(local, local.slice(0, 23).map(applied))
  assert.equal(plan.pending.length, 13)
  assert.equal(plan.pending[0].version, "20260528000000")
  assert.equal(plan.pending[0].reviewRequired, true)
})

test("workflow serializes the shared DB, plans before approval/apply, and never resets or repairs", () => {
  const workflow = readFileSync(".github/workflows/deploy_dev_database.yaml", "utf8")
  assert.match(workflow, /types: \[labeled\]/)
  assert.match(workflow, /github.event.label.name == 'dev-db'/)
  assert.match(workflow, /group: burneto-shared-dev-database/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.equal(workflow.match(/environment: development-database/g)?.length, 2)
  assert.match(workflow, /needs: \[resolve, plan\]/)
  assert.match(workflow, /DB_PLAN_DIGEST: \$\{\{ needs.plan.outputs.digest \}\}/)
  assert.doesNotMatch(
    workflow,
    /pull_request_target:|head_sha:\n|SUPABASE_ACCESS_TOKEN|CLOUDFLARE_API_TOKEN/,
  )
  const runner = readFileSync("tools/dev-db/deploy.mjs", "utf8")
  assert.match(runner, /default_transaction_read_only=on/)
  assert.match(runner, /"--skip-vault"/)
  assert.doesNotMatch(runner, /"--include-all"|"--include-seed"|"--include-roles"|"reset"|"repair"/)
})

test("runner subprocesses keep password out of argv/logs and plan never invokes db push", () => {
  const directory = mkdtempSync(join(tmpdir(), "dev-db-runner-test-"))
  try {
    const bin = join(directory, "bin")
    const migrations = join(directory, "apps/api/supabase/migrations")
    mkdirSync(bin)
    mkdirSync(migrations, { recursive: true })
    for (const m of [a, b]) writeFileSync(join(migrations, `${m.version}_${m.name}.sql`), m.sql)
    const state = join(directory, "history.json")
    const calls = join(directory, "calls.jsonl")
    writeFileSync(state, JSON.stringify([applied(a)]))
    const sha = "a".repeat(40)
    const secret = "fixture password:@ must not appear"
    const executable = (name, script) =>
      writeFileSync(join(bin, name), `#!${process.execPath}\n${script}`, { mode: 0o700 })
    executable("git", `if(process.argv.includes('rev-parse')) console.log('${sha}')`)
    const record = `const fs=require('node:fs'); const args=process.argv.slice(2); if(args.some(a=>a.includes(process.env.PGPASSWORD||process.env.SUPABASE_DB_PASSWORD)))process.exit(90); fs.appendFileSync(process.env.MOCK_CALLS,JSON.stringify({tool:require('node:path').basename(process.argv[1]),args})+'\\n');`
    executable(
      "psql",
      record +
        `if(!process.env.PGOPTIONS.includes('default_transaction_read_only=on'))process.exit(91); if(args.at(-1).includes('to_regclass'))console.log('t');else console.log(fs.readFileSync(process.env.MOCK_STATE,'utf8'));`,
    )
    executable(
      "pnpm",
      record +
        `if(!process.env.SUPABASE_DB_PASSWORD||process.env.PGPASSWORD)process.exit(92); fs.writeFileSync(process.env.MOCK_STATE,JSON.stringify(${JSON.stringify([applied(a), applied(b)])})); console.log(process.env.SUPABASE_DB_PASSWORD);`,
    )
    const environment = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      MOCK_STATE: state,
      MOCK_CALLS: calls,
      DB_EXPECTED_SHA: sha,
      DEV_SUPABASE_PROJECT_REF: DEV_PROJECT_REF,
      DEV_DB_HOST: `db.${DEV_PROJECT_REF}.supabase.co`,
      DEV_SUPABASE_DB_PASSWORD: secret,
      DEV_DB_SSL_ROOT_CERT: "-----BEGIN CERTIFICATE-----\nfixture",
      GITHUB_OUTPUT: join(directory, "outputs"),
      GITHUB_STEP_SUMMARY: join(directory, "summary"),
    }
    const runner = fileURLToPath(new URL("./deploy.mjs", import.meta.url))
    const run = (mode, extra = {}) =>
      spawnSync(process.execPath, [runner, mode], {
        cwd: directory,
        env: { ...environment, ...extra },
        encoding: "utf8",
      })
    const plan = run("plan")
    assert.equal(plan.status, 0, plan.stderr)
    assert.doesNotMatch(readFileSync(calls, "utf8"), /"tool":"pnpm"/)
    const digest = /digest=([a-f0-9]{64})/.exec(readFileSync(environment.GITHUB_OUTPUT, "utf8"))[1]
    const result = run("apply", { DB_PLAN_DIGEST: digest })
    assert.equal(result.status, 0, result.stderr)
    const records = readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse)
    const push = records.find((r) => r.tool === "pnpm")
    assert.ok(push.args.includes("--skip-vault"))
    assert.ok(push.args.includes("--yes"))
    assert.ok(
      push.args.find((arg) => arg.startsWith("postgresql:")).includes("sslmode=verify-full"),
    )
    for (const text of [
      plan.stdout,
      plan.stderr,
      result.stdout,
      result.stderr,
      readFileSync(calls, "utf8"),
      readFileSync(environment.GITHUB_STEP_SUMMARY, "utf8"),
    ])
      assert.ok(!text.includes(secret))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

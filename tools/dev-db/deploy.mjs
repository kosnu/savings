import { spawnSync } from "node:child_process"
import {
  appendFileSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { databaseConnection, DEV_PROJECT_REF, executePlan } from "./migrations.mjs"

const mode = process.argv[2]
if (!["plan", "apply"].includes(mode)) throw new Error("Use plan or apply")
const env = process.env
const connection = databaseConnection(env)
const expectedSha = env.DB_EXPECTED_SHA
if (!/^[a-f0-9]{40}$/.test(expectedSha ?? ""))
  throw new Error("Full reviewed commit SHA is required")
const password = env.DEV_SUPABASE_DB_PASSWORD
const cleanEnv = Object.fromEntries(
  Object.entries(env).filter(([key]) => !/^(PG|SUPABASE_|DEV_|CLOUDFLARE_|VITE_)/.test(key)),
)
const run = (command, args, extra = {}) => {
  const result = spawnSync(command, args, {
    env: { ...cleanEnv, ...extra },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 600000,
  })
  // SQL・接続情報・エラー本文をログへ転記しない。秘密は argv へ入れない。
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed (exit ${result.status ?? "unknown"}); inspect migration history before retrying`,
    )
  return result.stdout.trim()
}
if (
  run("git", ["rev-parse", "HEAD"]) !== expectedSha ||
  run("git", ["status", "--porcelain", "--untracked-files=no"])
) {
  throw new Error("Checkout must be clean and match the approved SHA")
}
const directory = mkdtempSync(join(tmpdir(), "burneto-dev-db-"))
try {
  const certificate = join(directory, "root.crt")
  writeFileSync(certificate, env.DEV_DB_SSL_ROOT_CERT, { mode: 0o600 })
  const url = new URL(`postgresql://${connection.user}@${connection.host}:5432/postgres`)
  url.searchParams.set("sslmode", "verify-full")
  url.searchParams.set("sslrootcert", certificate)
  const psqlEnv = {
    PGPASSWORD: password,
    PGCONNECT_TIMEOUT: "20",
    PGOPTIONS:
      "-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000",
  }
  const query = (sql) =>
    run(
      "psql",
      [
        "-X",
        "--no-password",
        "--tuples-only",
        "--no-align",
        "--set",
        "ON_ERROR_STOP=1",
        "--dbname",
        url.href,
        "--command",
        sql,
      ],
      psqlEnv,
    )
  const readHistory = async () => {
    if (query("select to_regclass('supabase_migrations.schema_migrations') is not null") === "f") {
      if (
        query(
          "select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')) + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')",
        ) !== "0"
      ) {
        throw new Error("Untracked schema exists; no automatic baseline/history repair")
      }
      return []
    }
    return JSON.parse(
      query(
        "select coalesce(json_agg(t order by version),'[]'::json) from (select version,name,statements from supabase_migrations.schema_migrations) t",
      ),
    )
  }
  const path = "apps/api/supabase/migrations"
  const local = readdirSync(path)
    .sort()
    .map((file) => {
      const match = /^([0-9]{14})_([a-zA-Z0-9_]+)\.sql$/.exec(file)
      if (!match || !lstatSync(join(path, file)).isFile())
        throw new Error("Only regular versioned SQL migration files are allowed")
      return { version: match[1], name: match[2], sql: readFileSync(join(path, file), "utf8") }
    })
  const plan = await executePlan({
    local,
    readHistory,
    apply: mode === "apply",
    expectedDigest: env.DB_PLAN_DIGEST,
    push: async () => {
      run(
        "pnpm",
        [
          "exec",
          "supabase",
          "db",
          "push",
          "--workdir",
          "apps/api",
          "--db-url",
          url.href,
          "--skip-vault",
          "--yes",
        ],
        { SUPABASE_DB_PASSWORD: password },
      )
    },
  })
  const lines = [
    `Dev DB ${mode}: ${DEV_PROJECT_REF}`,
    `Commit: ${expectedSha}`,
    `Plan: ${plan.digest}`,
    `Applied history: ${plan.applied.length}; pending: ${plan.pending.length}`,
    ...(plan.appliedNow ?? plan.pending).map(
      (m) =>
        `${m.version}_${m.name}.sql ${m.fingerprint}${m.reviewRequired ? " [review destructive/data effects]" : ""}`,
    ),
    "Confirm shared Preview compatibility and every pending SQL before approving apply. Frontend rollback does not undo DB changes.",
  ]
  console.log(lines.join("\n"))
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `\n\`\`\`text\n${lines.join("\n")}\n\`\`\`\n`)
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `digest=${plan.digest}\n`)
} finally {
  rmSync(directory, { recursive: true, force: true })
}

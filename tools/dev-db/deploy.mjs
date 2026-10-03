import { spawnSync } from "node:child_process"
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  databaseCredentials,
  readDatabaseHistory,
  DEV_PROJECT_REF,
  executePlan,
} from "./migrations.mjs"

const mode = process.argv[2]
if (!["plan", "apply"].includes(mode)) throw new Error("Use plan or apply")
const env = process.env
const credentials = databaseCredentials(env)
const expectedSha = env.DB_EXPECTED_SHA
if (!/^[a-f0-9]{40}$/.test(expectedSha ?? ""))
  throw new Error("Full reviewed commit SHA is required")
const cleanEnv = Object.fromEntries(
  Object.entries(env).filter(
    ([key]) => !/^(PG|SUPABASE_|DEV_|CLOUDFLARE_|VITE_|AUTH_|SENTRY_)/.test(key),
  ),
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
  const readHistory = async () => readDatabaseHistory(credentials)
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
      // 本番と同じ link → db push。既存 .temp/認証キャッシュを使わない。
      const supabase = join(directory, "supabase")
      mkdirSync(join(supabase, "migrations"), { recursive: true })
      writeFileSync(join(supabase, "config.toml"), 'project_id = "burneto-dev-migrations"\n')
      for (const m of local)
        writeFileSync(join(supabase, "migrations", `${m.version}_${m.name}.sql`), m.sql)
      const cliEnv = {
        SUPABASE_ACCESS_TOKEN: credentials.token,
        SUPABASE_PROJECT_ID: credentials.ref,
        SUPABASE_HOME: join(directory, "cli-home"),
        SUPABASE_TELEMETRY_DISABLED: "true",
      }
      const cli = (args) =>
        run("pnpm", ["exec", "supabase", ...args, "--workdir", directory, "--agent", "no"], cliEnv)
      if (run("pnpm", ["exec", "supabase", "--version"]) !== "2.118.0")
        throw new Error("Reviewed Supabase CLI 2.118.0 is required")
      cli(["link", "--project-ref", credentials.ref])
      if (readFileSync(join(supabase, ".temp", "project-ref"), "utf8").trim() !== credentials.ref)
        throw new Error("Linked project does not match approved Dev project")
      cli(["db", "push", "--linked", "--skip-vault", "--yes"])
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

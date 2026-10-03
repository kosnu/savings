import { createHash } from "node:crypto"

export const DEV_PROJECT_REF = "ufekmuxkmodwydxmdbln"
export const hash = (value) => createHash("sha256").update(value).digest("hex")

// MCP の SQL 全文と CLI の statement 配列を比較する。文字列/関数本体は変更しない。
export function sqlFingerprint(sql) {
  const tokens = []
  let i = 0
  while (i < sql.length) {
    if (/\s/.test(sql[i]) || sql[i] === ";") {
      i++
      continue
    }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i)
      i = end < 0 ? sql.length : end + 1
      continue
    }
    if (sql.startsWith("/*", i)) {
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++
          i += 2
        } else if (sql.startsWith("*/", i)) {
          depth--
          i += 2
        } else i++
      }
      if (depth) throw new Error("Unterminated SQL comment")
      continue
    }
    const dollar = sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z_0-9]*)?\$/)?.[0]
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length)
      if (end < 0) throw new Error("Unterminated SQL function/string")
      tokens.push(sql.slice(i, end + dollar.length))
      i = end + dollar.length
      continue
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const start = i
      const quote = sql[i++]
      let closed = false
      while (i < sql.length) {
        if (sql[i] === "\\") {
          i += 2
          continue
        }
        if (sql[i++] === quote) {
          if (sql[i] === quote) {
            i++
            continue
          }
          closed = true
          break
        }
      }
      if (!closed) throw new Error("Unterminated SQL literal")
      tokens.push(sql.slice(start, i))
      continue
    }
    const token = sql
      .slice(i)
      .match(/^(?:[a-zA-Z_][a-zA-Z_0-9$]*|[0-9]+(?:\.[0-9]+)?|[+*/<>=~!@#%^&|?:-]+|[^\s])/)?.[0]
    if (!token) throw new Error("Unsupported SQL token")
    tokens.push(token.toLowerCase())
    i += token.length
  }
  return hash(JSON.stringify(tokens))
}

export function migrationPlan(local, remote) {
  for (const entries of [local, remote]) {
    const versions = entries.map((m) => m.version)
    if (
      new Set(versions).size !== versions.length ||
      versions.some((v) => !/^[0-9]{14}$/.test(v))
    ) {
      throw new Error("Invalid or duplicate migration version")
    }
    if (versions.join() !== [...versions].sort((a, b) => a.localeCompare(b)).join())
      throw new Error("Migration history is not ordered")
  }
  if (remote.length > local.length)
    throw new Error("Selected branch is missing shared DB migrations")
  const applied = remote.map((entry, i) => {
    const source = local[i]
    if (entry.version !== source.version || entry.name !== source.name) {
      throw new Error(`History conflict at ${entry.version}; incorporate shared migrations first`)
    }
    if (
      !Array.isArray(entry.statements) ||
      !entry.statements.length ||
      entry.statements.some((s) => typeof s !== "string")
    ) {
      throw new Error(`SQL evidence missing for ${entry.version}; no automatic history repair`)
    }
    const fingerprint = sqlFingerprint(source.sql)
    if (fingerprint !== sqlFingerprint(entry.statements.join(";\n"))) {
      throw new Error(`Applied SQL changed: ${entry.version}`)
    }
    return { version: entry.version, name: entry.name, fingerprint }
  })
  const pending = local.slice(remote.length).map((m) => ({
    version: m.version,
    name: m.name,
    fingerprint: sqlFingerprint(m.sql),
    reviewRequired: /\b(drop|truncate|delete|revoke)\b/i.test(m.sql),
  }))
  return { applied, pending, digest: hash(JSON.stringify({ applied, pending })) }
}

export function databaseCredentials(env) {
  if (env.SUPABASE_PROJECT_ID !== DEV_PROJECT_REF)
    throw new Error("Only the approved Burneto Dev project is allowed")
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error("A Dev-scoped SUPABASE_ACCESS_TOKEN is required")
  return { ref: DEV_PROJECT_REF, token: env.SUPABASE_ACCESS_TOKEN }
}

// 読取専用 API を固定し、redirect や応答本文をエラーへ転記しない。
export async function readDatabaseHistory(credentials, request = fetch) {
  const query = async (sql) => {
    let response
    try {
      response = await request(
        `https://api.supabase.com/v1/projects/${DEV_PROJECT_REF}/database/query/read-only`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: sql }),
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        },
      )
    } catch {
      throw new Error("Dev history request failed")
    }
    if (response.status !== 201) throw new Error(`Dev history read failed (${response.status})`)
    try {
      return await response.json()
    } catch {
      throw new Error("Invalid Dev history response")
    }
  }
  const exists = await query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as exists",
  )
  if (exists?.[0]?.exists === false) {
    const schema = await query(
      "select (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')) + (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as count",
    )
    if (String(schema?.[0]?.count) !== "0")
      throw new Error("Untracked schema exists; no automatic baseline/history repair")
    return []
  }
  if (exists?.[0]?.exists !== true) throw new Error("Invalid Dev history response")
  const history = await query(
    "select version,name,statements from supabase_migrations.schema_migrations order by version",
  )
  if (!Array.isArray(history)) throw new Error("Invalid Dev history response")
  return history
}

export async function executePlan({ local, readHistory, push, expectedDigest, apply }) {
  const plan = migrationPlan(local, await readHistory())
  if (!apply) return plan
  if (!expectedDigest || expectedDigest !== plan.digest)
    throw new Error("Database or migration plan changed after approval")
  if (plan.pending.length) await push()
  const verified = migrationPlan(local, await readHistory())
  if (verified.pending.length)
    throw new Error("Migration application is incomplete; inspect history before retrying")
  return { ...verified, appliedNow: plan.pending }
}

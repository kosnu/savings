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

export function databaseConnection(env) {
  if (env.DEV_SUPABASE_PROJECT_REF !== DEV_PROJECT_REF)
    throw new Error("Only the approved Burneto Dev project is allowed")
  const host = env.DEV_DB_HOST ?? ""
  const direct = host === `db.${DEV_PROJECT_REF}.supabase.co`
  if (!direct && !/^aws-[0-9]+-ap-northeast-1\.pooler\.supabase\.com$/.test(host)) {
    throw new Error("Use the Dev direct host or the Tokyo session pooler host from Connect")
  }
  if (!env.DEV_SUPABASE_DB_PASSWORD)
    throw new Error("Dev DB password is required through the protected secret")
  if (!env.DEV_DB_SSL_ROOT_CERT?.includes("-----BEGIN CERTIFICATE-----"))
    throw new Error("Dev CA certificate is required")
  return {
    host,
    user: direct ? "postgres" : `postgres.${DEV_PROJECT_REF}`,
    port: "5432",
    database: "postgres",
  }
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

import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleSqltie } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client'
import * as schema from './schema'

export interface Env {
  DB?: D1Database;
}

export function getDB(env?: Env) {
  // Cloudflare Workers 環境（D1）
  if (env?.DB) {
    return drizzleD1(env.DB, { schema })
  }
  // Nodeローカル開発環境（ただし Cloudflare Workers 上では `process` が存在しない）
  const isNode = typeof process !== 'undefined' && typeof process.env !== 'undefined'
  const dbUrl = isNode ? process.env.DATABASE_URL : undefined
  const authToken = isNode ? process.env.DATABASE_AUTH_TOKEN : undefined

  if (!dbUrl) throw new Error('DATABASE_URL not set')

  const client = createClient({
    url: dbUrl,
    authToken, // Turso使用時のみ
  })

  return drizzleSqltie(client, { schema })
}

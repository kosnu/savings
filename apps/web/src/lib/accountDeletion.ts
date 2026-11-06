import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import * as z from "zod"

import { env } from "../config/env"
import type { Database } from "../types/database.types"
import { getSupabaseClient } from "./supabase"

const times = {
  delete_after: z.iso.datetime({ offset: true }),
  purge_after: z.iso.datetime({ offset: true }),
}
export const deletionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_confirmed") }),
  z.object({ status: z.enum(["pending", "cancelled", "completed"]), ...times }),
])
export type DeletionResult = z.infer<typeof deletionResultSchema>
const myStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("active") }),
  z.object({
    status: z.literal("pending"),
    request_id: z.uuid(),
    can_reactivate: z.boolean(),
    ...times,
  }),
])
export type MyDeletionState = z.infer<typeof myStateSchema>
const previewSchema = z.object({
  auth_user_id: z.uuid(),
  email: z.string(),
  explanation_version: z.string(),
  sole_book_count: z.number().int().nonnegative(),
  shared_book_count: z.number().int().nonnegative(),
  accepting_requests: z.boolean(),
  ...times,
})
export type DeletionPreview = z.infer<typeof previewSchema>

export async function getMyDeletionState(client = getSupabaseClient()) {
  const { data, error } = await client.rpc("get_my_account_deletion_state")
  if (error) throw error
  return myStateSchema.parse(data)
}

export async function prepareAccountDeletion(client = getSupabaseClient()) {
  const { data, error } = await client.rpc("prepare_account_deletion")
  if (error) throw error
  return previewSchema.parse(data)
}

export async function reactivateAccount(requestId: string, client = getSupabaseClient()) {
  const { data, error } = await client.rpc("reactivate_my_account", { request_id: requestId })
  if (error) throw error
  const result = deletionResultSchema.parse(data)
  if (result.status !== "cancelled") throw new Error("Account reactivation unconfirmed")
  if ((await getMyDeletionState(client)).status !== "active")
    throw new Error("Account remains unavailable")
}

export const deletionReceiptKey = "burneto-account-deletion-receipt"
export const deletionReceiptEvent = "burneto-account-deletion-receipt-changed"
const receiptSchema = z.object({
  requestId: z.uuid(),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
  authUserId: z.uuid(),
  createdAt: z.number().finite(),
})
export type DeletionReceipt = z.infer<typeof receiptSchema>

export function readDeletionReceipt(): DeletionReceipt | null {
  const raw = localStorage.getItem(deletionReceiptKey)
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    clearDeletionReceipt()
    return null
  }
  const parsed = receiptSchema.safeParse(value)
  if (!parsed.success || Date.now() - parsed.data.createdAt >= 30 * 24 * 60 * 60 * 1000) {
    clearDeletionReceipt()
    return null
  }
  return parsed.data
}

export function clearDeletionReceipt() {
  localStorage.removeItem(deletionReceiptKey)
}

export function createDeletionReceipt(authUserId: string): DeletionReceipt {
  const existing = readDeletionReceipt()
  if (existing) throw new Error("Check the existing account deletion request first")
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const receipt = receiptSchema.parse({
    requestId: crypto.randomUUID(),
    secret: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    authUserId,
    createdAt: Date.now(),
  })
  localStorage.setItem(deletionReceiptKey, JSON.stringify(receipt))
  return receipt
}

export async function requestAccountDeletion(receipt: DeletionReceipt, version: string) {
  const client = getSupabaseClient()
  const { data: auth, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!auth.session || auth.session.user.id !== receipt.authUserId)
    throw new Error("Account identity mismatch")
  // 別タブの切替が重なっても、確認した本人のJWTでこの要求だけを送信する。
  const { data, error } = await client
    .rpc("request_account_deletion", {
      request_id: receipt.requestId,
      result_secret: receipt.secret,
      explanation_version: version,
    })
    .setHeader("Authorization", `Bearer ${auth.session.access_token}`)
  if (error) throw error
  return deletionResultSchema.parse(data)
}

let anonymousClient: SupabaseClient<Database> | undefined
export async function getDeletionResult(requestId: string, secret: string) {
  // 通常JWTが失効していても照会できる独立client。secretをquery keyやURLへ入れない。
  anonymousClient ??= createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "burneto-deletion-result",
    },
  })
  const { data, error } = await anonymousClient.rpc("get_account_deletion_result", {
    request_id: requestId,
    result_secret: secret,
  })
  if (error) throw error
  return deletionResultSchema.parse(data)
}

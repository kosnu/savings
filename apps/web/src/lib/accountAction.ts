import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import * as z from "zod"

import { env } from "../config/env"
import type { Database } from "../types/database.types"
import {
  clearDeletionReceipt,
  getMyDeletionState,
  reactivateAccount,
  readDeletionReceipt,
} from "./accountDeletion"
import { getSupabaseClient } from "./supabase"

export const accountActionPath = "/auth/account-action"
const markerKey = "burneto-account-action"
const storageKey = "burneto-account-action-session"
const loginMarkerKey = "burneto-explicit-login"
const markerSchema = z.object({
  authUserId: z.uuid().optional(),
  startedAt: z.number(),
})
let actionClient: SupabaseClient<Database> | undefined

function getActionClient() {
  actionClient ??= createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: sessionStorage,
      storageKey,
      flowType: "pkce",
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  })
  return actionClient
}

function clearActionStorage() {
  const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
    sessionStorage.key(index),
  )
  for (const key of keys) {
    if (key && (key === markerKey || key === storageKey || key.startsWith(`${storageKey}-`)))
      sessionStorage.removeItem(key)
  }
}

export async function startAccountAction(authUserId?: string) {
  const { data, error: sessionError } = await getSupabaseClient().auth.getSession()
  if (sessionError) throw sessionError
  const expectedUserId = authUserId ?? readDeletionReceipt()?.authUserId ?? data.session?.user.id
  if (data.session && expectedUserId && data.session.user.id !== expectedUserId)
    throw new Error("Account identity mismatch")
  await discardAccountAction()
  sessionStorage.setItem(
    markerKey,
    JSON.stringify({ authUserId: expectedUserId, startedAt: Date.now() }),
  )
  const { error } = await getActionClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${accountActionPath}`,
      queryParams: { prompt: "select_account" },
    },
  })
  if (error) {
    await discardAccountAction()
    throw error
  }
}

export async function discardAccountAction() {
  try {
    await getActionClient().auth.signOut({ scope: "local" })
  } finally {
    clearActionStorage()
  }
}

export async function completeAccountAction(): Promise<"retry" | "reactivate"> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get("code")
  // 失敗したcallbackにも認証codeやproviderのerror詳細を残さない。
  if (url.pathname === accountActionPath) window.history.replaceState(null, "", accountActionPath)
  try {
    const raw = sessionStorage.getItem(markerKey)
    sessionStorage.removeItem(markerKey)
    const marker = markerSchema.parse(raw ? JSON.parse(raw) : null)
    const age = Date.now() - marker.startedAt
    // 通常callbackへfallbackしない。markerは認可ではなく一回限りの画面継続にだけ使う。
    if (
      url.pathname !== accountActionPath ||
      age < 0 ||
      age >= 300_000 ||
      !code ||
      url.searchParams.has("error")
    )
      throw new Error("Account action expired")
    const client = getActionClient()
    const { data, error } = await client.auth.exchangeCodeForSession(code)
    if (error || !data.session) throw new Error("Account action sign-in failed")
    const { data: verified, error: userError } = await client.auth.getUser()
    if (
      userError ||
      !verified.user ||
      (marker.authUserId && marker.authUserId !== verified.user.id)
    )
      throw new Error("Account identity mismatch")
    let result: "retry" | "reactivate" = "reactivate"
    const state = await getMyDeletionState(client)
    if (state.status === "active" && readDeletionReceipt()?.authUserId === verified.user.id) {
      // 未着か応答喪失かは断定せず、同じ受付で再確認する画面へ戻す。
      result = "retry"
    } else if (state.status === "pending" && state.can_reactivate) {
      await reactivateAccount(state.request_id, client)
      const receipt = readDeletionReceipt()
      if (receipt?.authUserId === verified.user.id && receipt.requestId === state.request_id)
        clearDeletionReceipt()
    } else {
      throw new Error("Account cannot be reactivated")
    }
    // 消去に失敗した一時sessionを通常sessionへ昇格させない。
    clearActionStorage()
    const { error: promoteError } = await getSupabaseClient().auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    if (promoteError) throw promoteError
    // 引き継いだsessionをsignOutで失効させず、一時storageだけを除去する。
    return result
  } catch (error) {
    await discardAccountAction()
    throw error
  }
}

export function markExplicitLogin() {
  sessionStorage.setItem(loginMarkerKey, String(Date.now()))
}
export function consumeExplicitLogin(): boolean {
  const raw = sessionStorage.getItem(loginMarkerKey)
  sessionStorage.removeItem(loginMarkerKey)
  const age = Date.now() - Number(raw)
  return window.location.pathname === "/auth" && raw !== null && age >= 0 && age < 300_000
}

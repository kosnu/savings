import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { env } from "../config/env"
import { paths } from "../config/paths"
import { getMyDeletionState, reactivateAccount } from "./accountDeletion"
import { diagnosticCode } from "./sentryPrivacy"

const markerKey = "burneto-explicit-login"
const storageKey = "burneto-login-callback"
let loginAuth: SupabaseClient["auth"] | undefined

export function getLoginAuth() {
  loginAuth ??= createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storageKey,
      storage: sessionStorage,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).auth
  return loginAuth
}

function clearLoginStorage() {
  for (const key of Object.keys(sessionStorage)) {
    if (key === markerKey || key === storageKey || key.startsWith(`${storageKey}-`))
      sessionStorage.removeItem(key)
  }
}

export async function startExplicitLogin() {
  clearLoginStorage()
  sessionStorage.setItem(markerKey, String(Date.now()))
  try {
    const { error } = await getLoginAuth().signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${paths.auth.getHref()}` },
    })
    if (error) throw error
  } catch (error) {
    clearLoginStorage()
    throw error
  }
}

export function completeExplicitLogin(
  auth: SupabaseClient["auth"],
): Promise<string | undefined> | undefined {
  const url = new URL(window.location.href)
  if (url.pathname !== paths.auth.getHref()) return
  const fragment = new URLSearchParams(url.hash.slice(1))
  const code = url.searchParams.get("code")
  const failed = [fragment, url.searchParams].some((part) =>
    ["error", "error_description", "error_code"].some((key) => part.has(key)),
  )
  if (!code && !failed && !fragment.has("access_token") && !fragment.has("refresh_token")) return
  window.history.replaceState(window.history.state, "", paths.auth.getHref())

  const confirm = async () => {
    const raw = sessionStorage.getItem(markerKey)
    sessionStorage.removeItem(markerKey)
    const age = Date.now() - Number(raw)
    if (!raw || !code || failed || !Number.isFinite(age) || age < 0 || age >= 300_000)
      throw new Error("Login callback expired")
    const staging = getLoginAuth()
    const { data, error: exchangeError } = await staging.exchangeCodeForSession(code)
    if (exchangeError || !data.session) throw new Error("Login code exchange failed")
    const session = data.session
    try {
      const { data: verified, error: verificationError } = await staging.getUser(
        session.access_token,
      )
      if (verificationError || verified.user?.id !== session.user.id)
        throw new Error("Invalid login identity")
      const state = await getMyDeletionState(session.access_token)
      if (state.status === "pending") {
        if (!state.can_reactivate) throw new Error("Account reactivation expired")
        await reactivateAccount(state.request_id, session.access_token)
      }
      // SDKの一時保存を消去してから、通常sessionへ認証結果を引き継ぐ。
      clearLoginStorage()
      const { error: sessionError } = await auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      if (sessionError) throw sessionError
      return state.status === "pending" ? session.access_token : undefined
    } catch (error) {
      await staging.signOut({ scope: "local" })
      throw error
    }
  }
  return confirm().catch(() => {
    try {
      clearLoginStorage()
    } catch {
      // storageを利用できない場合も通常sessionを維持し、認証エラーを表示する。
    }
    const reason = new URLSearchParams({ error: "login_failed" })
    const diagnostic = url.searchParams.get("error_code") ?? fragment.get("error_code")
    if (diagnostic) reason.set("error_code", diagnosticCode(diagnostic))
    window.history.replaceState(window.history.state, "", `${paths.auth.getHref()}?${reason}`)
    return undefined
  })
}

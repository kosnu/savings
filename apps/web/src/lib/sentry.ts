import * as Sentry from "@sentry/react"

import { env } from "../config/env"
import type { AuthCallbackError } from "../utils/auth/extractAuthCallbackError"
import { diagnosticCode, privateBreadcrumb, privateErrorEvent } from "./sentryPrivacy"

export function initSentry() {
  const dsn = env.SENTRY_DSN

  // development mode の配信ビルドは許可し、通常の local 開発サーバーは除外する。
  if (!env.PROD || !dsn) {
    return
  }

  try {
    Sentry.init({
      dsn,
      // session envelope は beforeSend を通らないため、自動 session 収集を停止する。
      integrations: (defaults) =>
        defaults.filter((integration) => integration.name !== "BrowserSession"),
      beforeSend: privateErrorEvent,
      beforeBreadcrumb: privateBreadcrumb,
      maxBreadcrumbs: 20,
      sampleRate: 1,
      environment: env.SENTRY_ENVIRONMENT ?? env.MODE,
      // v11で広がった既定の収集範囲を、v10と同じ範囲に保つ。
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: {
          request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
          response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        },
        httpBodies: [],
        urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        graphQL: { document: false, variables: false },
      },
    })
  } catch {
    // 監視の初期化失敗をアプリの起動失敗にしない。
  }
}

export function captureAuthCallbackError(error: AuthCallbackError) {
  captureDiagnostic("auth", "auth_callback_error", error.code, "Authentication callback failed")
}

export function captureSupabaseSessionError(_error: unknown) {
  captureDiagnostic(
    "auth",
    "supabase_session_error",
    undefined,
    "Supabase session retrieval failed",
  )
}

export function captureMonthlyBudgetCreateError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined
  captureDiagnostic(
    "budgets",
    "monthly_budget_create_error",
    code,
    "Monthly budget creation failed",
  )
}

function captureDiagnostic(feature: string, context: string, code: unknown, message: string) {
  try {
    Sentry.withScope((scope) => {
      scope.setTag("feature", feature)
      scope.setContext(context, { code: diagnosticCode(code) })
      Sentry.captureMessage(message, "error")
    })
  } catch {
    // 監視の失敗をログインや予算操作へ伝播させない。
  }
}

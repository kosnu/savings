import * as Sentry from "@sentry/react"

import { env } from "../config/env"
import type { AuthCallbackError } from "../utils/auth/extractAuthCallbackError"

export function initSentry() {
  const dsn = env.SENTRY_DSN

  if (env.MODE !== "production" || !dsn) {
    return
  }

  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? env.MODE,
  })
}

export function captureAuthCallbackError(error: AuthCallbackError) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "auth")
    scope.setContext("auth_callback_error", {
      code: error.code,
    })

    Sentry.captureMessage("Authentication callback failed", "error")
  })
}

export function captureSupabaseSessionError(error: unknown) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "auth")
    scope.setContext("supabase_session_error", {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
    })

    Sentry.captureMessage("Supabase session retrieval failed", "error")
  })
}

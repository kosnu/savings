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

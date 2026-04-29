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

export function captureMonthlyBudgetCreateError(error: unknown) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "budgets")
    scope.setContext("monthly_budget_create_error", {
      code: getErrorCode(error),
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : getErrorMessage(error),
    })

    Sentry.captureMessage("Monthly budget creation failed", "error")
  })
}

export function captureCategoryBudgetCreateError(error: unknown) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "budgets")
    scope.setContext("category_budget_create_error", {
      code: getErrorCode(error),
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : getErrorMessage(error),
    })

    Sentry.captureMessage("Category budget creation failed", "error")
  })
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined
  }

  return typeof error.code === "string" ? error.code : undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return String(error)
}

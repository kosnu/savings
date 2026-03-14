import * as Sentry from "@sentry/react"

import { env } from "../config/env"

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

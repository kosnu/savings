import { useEffect, useRef } from "react"

import { captureAuthCallbackError } from "../../lib/sentry"
import { extractAuthCallbackError } from "./extractAuthCallbackError"

export function useAuthCallbackError(url: string) {
  const authError = extractAuthCallbackError(url)
  const lastReportedHrefRef = useRef<string | null>(null)

  useEffect(() => {
    if (!authError) return
    if (lastReportedHrefRef.current === url) return

    captureAuthCallbackError(authError)
    lastReportedHrefRef.current = url
  }, [authError, url])

  return authError
}

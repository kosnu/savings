import type { Breadcrumb, ErrorEvent, StackFrame } from "@sentry/react"

const messages = new Set([
  "Authentication callback failed",
  "Supabase session retrieval failed",
  "Monthly budget creation failed",
])
const errorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
])
const errorCodes = new Set([
  "unexpected_failure",
  "access_denied",
  "otp_expired",
  "bad_oauth_state",
  "bad_oauth_callback",
  "oauth_provider_not_supported",
  "flow_state_expired",
  "flow_state_not_found",
  "signup_disabled",
  "23505",
  "23503",
  "23502",
  "42501",
  "PGRST301",
  "PGRST302",
  "PGRST116",
])

export function diagnosticCode(value: unknown): string {
  return typeof value === "string" && errorCodes.has(value) ? value : "unknown"
}

function assetUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, window.location.origin)
    // 配信した静的JSだけを残し、外部URL・query・fragment・動的IDは送らない。
    if (url.origin === window.location.origin && /^\/assets\/[\w-]+\.js$/.test(url.pathname)) {
      return `${url.origin}${url.pathname}`
    }
  } catch {
    return undefined
  }
  return undefined
}

function frameLocation(frame: StackFrame): StackFrame {
  return {
    filename: assetUrl(frame.filename),
    abs_path: assetUrl(frame.abs_path),
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
  }
}

export function privateBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category !== "xhr" && breadcrumb.category !== "fetch") return null
  const method = breadcrumb.data?.method
  const status = breadcrumb.data?.status_code
  return {
    category: breadcrumb.category,
    type: "http",
    timestamp: breadcrumb.timestamp,
    data: {
      method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)
        ? method
        : undefined,
      status_code:
        typeof status === "number" && status >= 100 && status <= 599 ? status : undefined,
    },
  }
}

// 正規表現による機微語の検出だけに依存せず、診断に必要なフィールドから再構成する。
export function privateErrorEvent(event: ErrorEvent): ErrorEvent {
  const contexts: ErrorEvent["contexts"] = {}
  for (const key of [
    "auth_callback_error",
    "supabase_session_error",
    "monthly_budget_create_error",
  ]) {
    if (event.contexts?.[key]) contexts[key] = { code: diagnosticCode(event.contexts[key]?.code) }
  }
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    message: messages.has(event.message ?? "") ? event.message : "Application error",
    tags: ["auth", "budgets"].includes(String(event.tags?.feature))
      ? { feature: event.tags?.feature }
      : undefined,
    contexts,
    exception: event.exception && {
      values: event.exception.values?.map((exception) => ({
        type: errorTypes.has(exception.type ?? "") ? exception.type : "Error",
        value: "[Removed]",
        mechanism: exception.mechanism && {
          type: ["generic", "onerror", "onunhandledrejection", "instrument", "react"].includes(
            exception.mechanism.type,
          )
            ? exception.mechanism.type
            : "generic",
          handled: exception.mechanism.handled,
        },
        stacktrace: exception.stacktrace && {
          frames: exception.stacktrace.frames?.map(frameLocation),
        },
      })),
    },
    breadcrumbs: event.breadcrumbs?.flatMap((breadcrumb) => {
      const safe = privateBreadcrumb(breadcrumb)
      return safe ? [safe] : []
    }),
    debug_meta: event.debug_meta && {
      images: event.debug_meta.images?.flatMap((image) => {
        const codeFile = assetUrl(image.code_file)
        return codeFile &&
          /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(image.debug_id ?? "")
          ? [{ type: "sourcemap", code_file: codeFile, debug_id: image.debug_id }]
          : []
      }),
    },
  }
}

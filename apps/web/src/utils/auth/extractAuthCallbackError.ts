export interface AuthCallbackError {
  code?: string
  description?: string
}

export function extractAuthCallbackError(url: string): AuthCallbackError | null {
  const parsed = new URL(url)
  const search = parsed.searchParams
  const hash = toSearchParams(parsed.hash)

  const error = search.get("error") ?? hash.get("error")

  if (!error) return null

  return {
    code: search.get("error_code") ?? hash.get("error_code") ?? undefined,
    description: decodeDescription(
      search.get("error_description") ?? hash.get("error_description"),
    ),
  }
}

function toSearchParams(fragment: string): URLSearchParams {
  const normalized =
    fragment.startsWith("?") || fragment.startsWith("#") ? fragment.slice(1) : fragment
  return new URLSearchParams(normalized)
}

function decodeDescription(description: string | null): string | undefined {
  if (!description) return undefined

  try {
    const decoded = decodeURIComponent(description)

    try {
      // Supabase callback では `Unable%253A...` のように二重エンコードされる場合がある。
      return decodeURIComponent(decoded)
    } catch {
      return decoded
    }
  } catch {
    return description
  }
}

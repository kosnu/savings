import { DomainError } from "../../shared/errors.ts"
import { isPostgrestError } from "../../shared/supabase/isPostgrestError.ts"

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const

export function createErrorResponse(error: DomainError): Response {
  if (error.type === "ValidationError") {
    return new Response(
      JSON.stringify({ message: error.message, details: error.details }),
      { status: 400, headers: JSON_HEADERS },
    )
  }

  if (error.type === "NotFoundError") {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  if (error.type === "UnexpectedError" && isPostgrestError(error.original)) {
    const pgError = error.original
    return new Response(
      JSON.stringify({
        message: pgError.message,
        details: pgError.details,
        hint: pgError.hint,
        code: pgError.code,
      }),
      { status: 500, headers: JSON_HEADERS },
    )
  }

  return new Response(JSON.stringify({ message: error.message }), {
    status: 500,
    headers: JSON_HEADERS,
  })
}

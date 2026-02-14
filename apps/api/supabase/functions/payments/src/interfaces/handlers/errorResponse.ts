import * as z from "@zod/zod"
import {
  DomainError,
  isNotFoundError,
  isUnexpectedError,
  isValidationError,
} from "../../shared/errors.ts"
import { isPostgrestError } from "../../shared/supabase/isPostgrestError.ts"

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const

export function createErrorResponse<T extends Record<string, unknown>>(
  error: DomainError | z.ZodError<T>,
): Response {
  if (error instanceof z.ZodError) {
    const flattenError = z.flattenError(error)
    return new Response(
      JSON.stringify(flattenError),
      { status: 400, headers: JSON_HEADERS },
    )
  }

  if (isValidationError(error)) {
    return new Response(
      JSON.stringify({ message: error.message, details: error.details }),
      { status: 400, headers: JSON_HEADERS },
    )
  }

  if (isNotFoundError(error)) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  if (isUnexpectedError(error) && isPostgrestError(error.original)) {
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

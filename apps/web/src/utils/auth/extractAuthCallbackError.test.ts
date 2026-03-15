import { describe, expect, test } from "vitest"

import { extractAuthCallbackError } from "./extractAuthCallbackError"

describe("extractAuthCallbackError", () => {
  test("query string の auth エラーを抽出できる", () => {
    const error = extractAuthCallbackError(
      "http://localhost:5173/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc",
    )

    expect(error).toEqual({
      code: "unexpected_failure",
      description: "Unable to exchange external code: abc",
    })
  })

  test("hash fragment の auth エラーを抽出できる", () => {
    const error = extractAuthCallbackError(
      "http://localhost:5173/auth#error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%253A+abc",
    )

    expect(error).toEqual({
      code: "unexpected_failure",
      description: "Unable to exchange external code: abc",
    })
  })

  test("auth エラーがない URL では null を返す", () => {
    expect(extractAuthCallbackError("http://localhost:5173/auth")).toBeNull()
  })
})

import { describe, expect, test } from "vite-plus/test"

import { isPostgresUniqueViolationError, POSTGRES_UNIQUE_VIOLATION_CODE } from "./postgresError"

describe("isPostgresUniqueViolationError", () => {
  test("PostgreSQL unique_violation は true を返す", () => {
    expect(isPostgresUniqueViolationError({ code: POSTGRES_UNIQUE_VIOLATION_CODE })).toBe(true)
  })

  test("code が異なる object は false を返す", () => {
    expect(isPostgresUniqueViolationError({ code: "23503" })).toBe(false)
  })

  test("code がない object は false を返す", () => {
    expect(isPostgresUniqueViolationError({ message: "network error" })).toBe(false)
  })

  test("undefined は false を返す", () => {
    expect(isPostgresUniqueViolationError(undefined)).toBe(false)
  })
})

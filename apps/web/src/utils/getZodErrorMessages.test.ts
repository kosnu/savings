import { describe, expect, test } from "vitest"
import { z } from "zod"

import { getZodErrorMessages } from "./getZodErrorMessages"

describe("getZodErrorMessages", () => {
  test("form error と field error をまとめて返す", () => {
    const schema = z.strictObject({
      amount: z.number(),
    })

    const result = schema.safeParse({
      amount: "invalid",
      extraKey: true,
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(getZodErrorMessages(result.error)).toEqual([
      'Unrecognized key: "extraKey"',
      "Invalid input: expected number, received string",
    ])
  })

  test("message がなければ undefined を返す", () => {
    expect(getZodErrorMessages(new z.ZodError([]))).toBeUndefined()
  })
})

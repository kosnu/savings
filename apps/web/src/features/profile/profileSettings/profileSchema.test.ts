import { describe, expect, test } from "vite-plus/test"

import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from "./profileSchema"

describe("displayNameSchema", () => {
  test("64文字の表示名を受け入れる", () => {
    expect(displayNameSchema.safeParse("a".repeat(DISPLAY_NAME_MAX_LENGTH)).success).toBe(true)
  })

  test("65文字の表示名を拒否する", () => {
    const result = displayNameSchema.safeParse("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.issues[0]?.message).toBe("Display name must be 64 characters or less")
  })

  test("Unicodeコードポイントで64文字の表示名を受け入れる", () => {
    expect(displayNameSchema.safeParse("😀".repeat(DISPLAY_NAME_MAX_LENGTH)).success).toBe(true)
  })

  test("Unicodeコードポイントで65文字の表示名を拒否する", () => {
    expect(displayNameSchema.safeParse("😀".repeat(DISPLAY_NAME_MAX_LENGTH + 1)).success).toBe(
      false,
    )
  })
})

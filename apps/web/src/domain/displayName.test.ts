import { describe, expect, test } from "vite-plus/test"

import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema, toInitialDisplayName } from "./displayName"

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

  test("Unicodeコードポイントで文字数を判定する", () => {
    expect(displayNameSchema.safeParse("😀".repeat(DISPLAY_NAME_MAX_LENGTH)).success).toBe(true)
    expect(displayNameSchema.safeParse("😀".repeat(DISPLAY_NAME_MAX_LENGTH + 1)).success).toBe(
      false,
    )
  })
})

describe("toInitialDisplayName", () => {
  test("name、fullName、email local-partの順でtrim済みの値を採用する", () => {
    expect(
      toInitialDisplayName({
        name: "  Metadata Name  ",
        fullName: "Full Name",
        email: "email-name@example.com",
      }),
    ).toBe("Metadata Name")
    expect(
      toInitialDisplayName({
        name: " ",
        fullName: "  Full Name  ",
        email: "email-name@example.com",
      }),
    ).toBe("Full Name")
    expect(toInitialDisplayName({ email: "  email-name@example.com  " })).toBe("email-name")
  })

  test("利用できる値がない場合はUserを採用する", () => {
    expect(toInitialDisplayName({ name: null, fullName: undefined, email: null })).toBe("User")
  })

  test("64文字の初期表示名を維持する", () => {
    expect(toInitialDisplayName({ name: "a".repeat(DISPLAY_NAME_MAX_LENGTH) })).toBe(
      "a".repeat(DISPLAY_NAME_MAX_LENGTH),
    )
  })

  test("65文字の初期表示名を先頭64コードポイントに切り詰める", () => {
    expect(toInitialDisplayName({ name: "😀".repeat(DISPLAY_NAME_MAX_LENGTH + 1) })).toBe(
      "😀".repeat(DISPLAY_NAME_MAX_LENGTH),
    )
  })
})

import { expect, test } from "vite-plus/test"

import { getDateLocale, toAppLanguage } from "./index"

test("toAppLanguage normalizes Japanese language tags", () => {
  expect(toAppLanguage("ja-JP")).toBe("ja")
  expect(getDateLocale("ja-JP")).toBe("ja-JP")
})

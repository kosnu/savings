import { expect, test } from "vite-plus/test"

import { getDateLocale, toAppLanguage } from "./index"

test("対応言語を日本語と英語に正規化する", () => {
  expect(toAppLanguage("ja-JP")).toBe("ja")
  expect(toAppLanguage("ja")).toBe("ja")
  expect(toAppLanguage("en-US")).toBe("en")
  expect(toAppLanguage("unknown")).toBe("en")
  expect(toAppLanguage(undefined)).toBe("en")
  expect(getDateLocale("ja-JP")).toBe("ja-JP")
})

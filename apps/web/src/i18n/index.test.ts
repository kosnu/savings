import { expect, test } from "vite-plus/test"

import { findSupportedAppLanguage, getDateLocale, toAppLanguage } from "./index"

test("toAppLanguage normalizes Japanese language tags", () => {
  expect(toAppLanguage("ja-JP")).toBe("ja")
  expect(getDateLocale("ja-JP")).toBe("ja-JP")
})

test("findSupportedAppLanguageは候補順で最初の対応言語を返す", () => {
  expect(findSupportedAppLanguage(["fr-FR", "ja-JP", "en-US"])).toBe("ja")
  expect(findSupportedAppLanguage(["en-GB", "ja-JP"])).toBe("en")
  expect(findSupportedAppLanguage(["FR-fr", "JA-jp"])).toBe("ja")
})

test("findSupportedAppLanguageは対応言語がなければnullを返す", () => {
  expect(findSupportedAppLanguage(["fr-FR", "de-DE"])).toBeNull()
  expect(findSupportedAppLanguage([])).toBeNull()
})

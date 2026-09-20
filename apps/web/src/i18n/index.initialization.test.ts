import i18nextSingleton from "i18next"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

beforeEach(() => {
  // 外部moduleのsingletonはresetModulesで破棄されないため、前回の購読を解除する。
  i18nextSingleton.off("languageChanged")
  vi.resetModules()
})

afterEach(() => {
  i18nextSingleton.off("languageChanged")
  vi.unstubAllGlobals()
})

// 翻訳instanceへ言語を注入せず、ブラウザ入力から本番の初期化を通して確認する。
test.each([
  { saved: "ja", languages: ["en-US"], expected: "ja" },
  { saved: "en", languages: ["ja-JP"], expected: "en" },
  { saved: null, languages: ["ja-JP", "en-US"], expected: "ja" },
  { saved: null, languages: ["en-GB", "ja-JP"], expected: "en" },
  { saved: null, languages: ["fr-FR", "ja-JP", "en-US"], expected: "ja" },
  { saved: null, languages: ["fr-FR", "en-US", "ja-JP"], expected: "en" },
  { saved: null, languages: ["JA-jp"], expected: "ja" },
  { saved: null, languages: ["fr-FR"], expected: "ja" },
  { saved: "invalid", languages: ["en-US"], expected: "en" },
  { saved: "", languages: ["ja-JP"], expected: "ja" },
])(
  "保存値 $saved・ブラウザ $languages から $expected で起動する",
  async ({ saved, languages, expected }) => {
    const setItem = vi.fn()
    vi.stubGlobal("window", {
      localStorage: { getItem: () => saved, setItem },
      navigator: { languages, language: "en-US" },
    })

    const { i18next } = await import("./index")

    expect(i18next.resolvedLanguage).toBe(expected)
    expect(i18next.t("navigation.settings")).toBe(expected === "ja" ? "設定" : "Settings")
    expect(setItem).not.toHaveBeenCalled()

    await i18next.changeLanguage(expected === "ja" ? "en" : "ja")
    expect(setItem).toHaveBeenCalledWith("appLanguage", expected === "ja" ? "en" : "ja")
  },
)

test.each([
  { language: "en-US", expected: "en" },
  { language: "ja-JP", expected: "ja" },
  { language: "fr-FR", expected: "ja" },
  { language: "", expected: "ja" },
])("優先言語リストが空ならブラウザ言語 $language を使う", async ({ language, expected }) => {
  vi.stubGlobal("window", {
    localStorage: { getItem: () => null },
    navigator: { languages: [], language },
  })

  const { i18next } = await import("./index")

  expect(i18next.resolvedLanguage).toBe(expected)
})

test("保存設定の読込失敗でもブラウザ言語で起動する", async () => {
  vi.stubGlobal("window", {
    get localStorage() {
      throw new Error("Storage is unavailable")
    },
    navigator: { languages: ["en-US"], language: "en-US" },
  })

  const { i18next } = await import("./index")

  expect(i18next.resolvedLanguage).toBe("en")
  await i18next.changeLanguage("ja")
  expect(i18next.resolvedLanguage).toBe("ja")
})

test("ブラウザがない環境の既定言語は日本語", async () => {
  vi.stubGlobal("window", undefined)

  const { i18next } = await import("./index")

  expect(i18next.resolvedLanguage).toBe("ja")
  expect(i18next.t("navigation.settings")).toBe("設定")
})

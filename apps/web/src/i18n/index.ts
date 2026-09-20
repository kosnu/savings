import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import { resources } from "./resources"

export type AppLanguage = keyof typeof resources

export const appLanguages = ["en", "ja"] as const satisfies readonly AppLanguage[]

export const appLanguageLabelKeys = {
  en: "language.en",
  ja: "language.ja",
} satisfies Record<AppLanguage, string>

const LANGUAGE_STORAGE_KEY = "appLanguage"
const DEFAULT_LANGUAGE: AppLanguage = "ja"

export function toAppLanguage(language: string | undefined): AppLanguage {
  if (language === "ja" || language?.startsWith("ja-")) return "ja"
  return "en"
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE
  }

  let savedLanguage: string | null = null
  try {
    savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // 保存設定を読めない場合も、ブラウザの優先言語を利用する。
  }

  const browserLanguages = window.navigator.languages.length
    ? window.navigator.languages
    : [window.navigator.language]

  for (const language of [savedLanguage, ...browserLanguages]) {
    const primaryLanguage = language?.toLowerCase().split("-")[0]
    if (primaryLanguage === "ja" || primaryLanguage === "en") return primaryLanguage
  }

  return DEFAULT_LANGUAGE
}

void i18next.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

i18next.on("languageChanged", (language) => {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, toAppLanguage(language))
  } catch {
    // ストレージが利用できない場合も、メモリ上の言語変更は維持する。
  }
})

export function getDateLocale(language: string | undefined): string {
  return toAppLanguage(language) === "ja" ? "ja-JP" : "en-US"
}

export function getDateFormat(language: string | undefined): string {
  return toAppLanguage(language) === "ja" ? "yyyy/MM/dd" : "MMM d, yyyy"
}

export { i18next }

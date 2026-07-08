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

export function toAppLanguage(language: string | undefined): AppLanguage {
  if (language === "ja") return "ja"
  return "en"
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en"
  }

  return toAppLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? undefined)
}

void i18next.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

i18next.on("languageChanged", (language) => {
  if (typeof window === "undefined") return

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, toAppLanguage(language))
})

export function getDateLocale(language: string | undefined): string {
  return toAppLanguage(language) === "ja" ? "ja-JP" : "en-US"
}

export function getDateFormat(language: string | undefined): string {
  return toAppLanguage(language) === "ja" ? "yyyy/MM/dd" : "MMM d, yyyy"
}

export { i18next }

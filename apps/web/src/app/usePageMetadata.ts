import { useRouterState, type AnyRouter } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { toAppLanguage } from "../i18n"
import { getPageMetadata } from "./pageMetadata"

export function usePageMetadata(router: AnyRouter, authenticated: boolean) {
  const pathname = useRouterState({ router, select: (state) => state.location.pathname })
  const { i18n } = useTranslation()
  const language = toAppLanguage(i18n.resolvedLanguage)

  useEffect(() => {
    const metadata = getPageMetadata(pathname, language, authenticated)
    document.documentElement.lang = language
    document.title = metadata.title

    for (const [attribute, key, value] of [
      ["name", "description", metadata.description],
      ["name", "robots", metadata.robots],
      ["property", "og:title", metadata.title],
      ["property", "og:description", metadata.description],
      ["property", "og:url", metadata.canonical],
      ["property", "og:locale", language === "ja" ? "ja_JP" : "en_US"],
      ["name", "twitter:title", metadata.title],
      ["name", "twitter:description", metadata.description],
    ] as const) {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
      if (value === undefined) {
        existing?.remove()
        continue
      }
      const element = existing ?? document.createElement("meta")
      element.setAttribute(attribute, key)
      element.content = value
      if (!existing) document.head.append(element)
    }

    const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (metadata.canonical) {
      const element = existing ?? document.createElement("link")
      element.rel = "canonical"
      element.href = metadata.canonical
      if (!existing) document.head.append(element)
    } else {
      existing?.remove()
    }
  }, [pathname, language, authenticated])
}

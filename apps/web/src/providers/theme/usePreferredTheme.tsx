import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react"

import { isThemePreference, type TTheme, type TThemePreference } from "./types"

const colorSchemeQuery = "(prefers-color-scheme: dark)"

export function usePreferredTheme() {
  const [themePreference, setThemePreference] = useState<TThemePreference>(() => {
    try {
      const stored = localStorage.getItem("theme")
      return isThemePreference(stored) ? stored : "system"
    } catch {
      return "system"
    }
  })

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (themePreference !== "system") return () => {}

      const mediaQuery = window.matchMedia(colorSchemeQuery)
      mediaQuery.addEventListener("change", onChange)
      return () => mediaQuery.removeEventListener("change", onChange)
    },
    [themePreference],
  )

  const systemTheme = useSyncExternalStore(subscribe, () =>
    window.matchMedia(colorSchemeQuery).matches ? "dark" : "light",
  )
  const theme: TTheme = themePreference === "system" ? systemTheme : themePreference

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeColor) {
      themeColor.content = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background")
        .trim()
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem("theme", themePreference)
    } catch {
      // 保存できない場合も選択した配色の表示は継続する。
    }
  }, [themePreference])

  const toggleTheme = useCallback(() => {
    setThemePreference((currentPreference) => {
      const currentTheme = currentPreference === "system" ? systemTheme : currentPreference
      return currentTheme === "dark" ? "light" : "dark"
    })
  }, [systemTheme])

  const changeTheme = useCallback((nextTheme: TThemePreference) => {
    setThemePreference(nextTheme)
  }, [])

  return { theme, themePreference, toggleTheme, changeTheme }
}

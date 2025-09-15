import { useCallback, useEffect, useState } from "react"
import type { TTheme } from "./types"

export function usePreferredTheme() {
  const [theme, setTheme] = useState<TTheme>(() => {
    const stored = localStorage.getItem("theme") as TTheme | null
    if (stored) return stored
    // システム設定を反映
    const prefersDark =
      window?.matchMedia("(prefers-color-scheme: dark)").matches ?? false
    return prefersDark ? "dark" : "light"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((theme) => (theme === "dark" ? "light" : "dark"))
  }, [])

  return { theme, toggleTheme }
}

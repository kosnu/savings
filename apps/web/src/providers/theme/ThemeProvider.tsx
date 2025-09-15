import { Theme as RadixUiTheme } from "@radix-ui/themes"
import { createContext, type ReactNode, useContext } from "react"
import { usePreferredTheme } from "./usePreferredTheme"

import "@radix-ui/themes/styles.css"
import "./radixTheme.css"

// NOTE: 外部公開してはいけない
const ThemeContext = createContext<{ toggleTheme: () => void } | undefined>(
  undefined,
)

const accentColor = "violet"
const panelBackground = "solid"
const radius = "medium"

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme, toggleTheme } = usePreferredTheme()

  return (
    <ThemeContext.Provider value={{ toggleTheme: toggleTheme }}>
      <RadixUiTheme
        accentColor={accentColor}
        panelBackground={panelBackground}
        radius={radius}
        appearance={theme}
      >
        {children}
      </RadixUiTheme>
    </ThemeContext.Provider>
  )
}

export function useChangeTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useChangeTheme must be used within ThemeProvider")
  }
  return ctx
}

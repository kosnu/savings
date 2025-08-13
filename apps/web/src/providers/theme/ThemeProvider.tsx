import { Theme as RadixUiTheme } from "@radix-ui/themes"

import "@radix-ui/themes/styles.css"
import "./radixTheme.css"

const accentColor = "gray"
const panelBackground = "solid"
const radius = "medium"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <RadixUiTheme
      accentColor={accentColor}
      panelBackground={panelBackground}
      radius={radius}
    >
      {children}
    </RadixUiTheme>
  )
}

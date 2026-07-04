import { Cross1Icon } from "@radix-ui/react-icons"
import * as Toast from "@radix-ui/react-toast"
import { IconButton } from "@radix-ui/themes"
import { type ReactNode, useCallback, useEffect, useRef } from "react"

import { useTheme } from "../../../providers/theme/ThemeProvider"
import type { TTheme } from "../../../providers/theme/types"

import styles from "./Snackbar.module.css"

type SnackbarType = "info" | "success" | "warning" | "error"

type SnackbarAccentColor = "gray" | "green" | "yellow" | "red"

const infoAccentColorByTheme = {
  light: "gray",
  dark: "gray",
} satisfies Record<TTheme, SnackbarAccentColor>

const accentColorMap = {
  success: "green",
  warning: "yellow",
  error: "red",
} satisfies Record<Exclude<SnackbarType, "info">, SnackbarAccentColor>

function getAccentColor(type: SnackbarType, theme: TTheme): SnackbarAccentColor {
  if (type === "info") {
    return infoAccentColorByTheme[theme]
  }

  return accentColorMap[type]
}

type SnackbarProps = {
  message: ReactNode
  type?: SnackbarType
  duration?: number
  open: boolean
  onClose: () => void
}

export function Snackbar({
  message,
  type = "info",
  open,
  duration = 3000,
  onClose,
}: SnackbarProps) {
  const timerRef = useRef(0)
  const { theme } = useTheme()

  const handleToastAction = useCallback(() => {
    window.clearTimeout(timerRef.current)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(onClose, duration)
    }
    return () => clearTimeout(timerRef.current)
  }, [open, duration, onClose])

  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root
        className={styles.toastRoot}
        data-accent-color={getAccentColor(type, theme)}
        open={open}
      >
        <Toast.Description className={styles.toastDescription}>{message}</Toast.Description>
        <Toast.Action
          asChild
          className={styles.toastAction}
          onClick={handleToastAction}
          altText="Close this snackbar."
        >
          <CloseButton />
        </Toast.Action>
      </Toast.Root>
      <Toast.Viewport className={styles.toastViewport} />
    </Toast.Provider>
  )
}

function CloseButton() {
  return (
    <IconButton size="2" radius="full" variant="soft">
      <Cross1Icon />
    </IconButton>
  )
}

import { Cross1Icon } from "@radix-ui/react-icons"
import { IconButton } from "@radix-ui/themes"
import { Toast } from "radix-ui"
import { type ReactNode, useCallback, useEffect, useRef } from "react"
import styles from "./Snackbar.module.css"

type SnackbarType = "info" | "success" | "warning" | "error"

const accentColorMap = {
  info: {
    color: "white",
  },
  success: {
    color: "green",
  },
  warning: {
    color: "yellow",
  },
  error: {
    color: "red",
  },
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
        data-accent-color={accentColorMap[type].color}
        open={open}
      >
        <Toast.Description className={styles.toastDescription}>
          {message}
        </Toast.Description>
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

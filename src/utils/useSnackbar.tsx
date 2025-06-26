import { type JSX, useCallback, useState } from "react"
import { Snackbar } from "../components/feedbacks/Snackbar"

type SnackbarType = "success" | "error" | "info" | "warning"

interface UseSnackbarReturn {
  openSnackbar: (message: string) => void
  Snackbar: () => JSX.Element
}

export function useSnackbar(type: SnackbarType): UseSnackbarReturn {
  const [open, setOpen] = useState(false)
  const [snackbarProps, setSnackbarProps] = useState<{
    message: string
    duration?: number
  }>({
    message: "",
    duration: 3000,
  })

  const openSnackbar = useCallback((message: string, duration?: number) => {
    setOpen(true)
    setSnackbarProps((prevState) => {
      return {
        ...prevState,
        message: message,
        duration: duration,
      }
    })
  }, [])

  const closeSnackbar = useCallback(() => {
    setOpen(false)
  }, [])

  const SnackbarComponent = useCallback(() => {
    return (
      <Snackbar
        type={type}
        open={open}
        message={snackbarProps.message}
        duration={snackbarProps.duration}
        onClose={closeSnackbar}
      />
    )
  }, [type, open, snackbarProps, closeSnackbar])

  return {
    openSnackbar: openSnackbar,
    Snackbar: SnackbarComponent,
  }
}

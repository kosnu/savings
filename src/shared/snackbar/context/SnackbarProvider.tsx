import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"
import { Snackbar } from "../components/Snackbar"
import type { OpenSnackbarFn, SnackbarState, SnackbarType } from "../types"

// NOTE: 外部公開してはいけない
const SnackbarContext = createContext<
  { openSnackbar: OpenSnackbarFn } | undefined
>(undefined)

interface SnackbarProviderProps {
  children: ReactNode
}

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [snackbarProps, setSnackbarProps] = useState<SnackbarState | null>(null)

  const openSnackbar = useCallback(
    (type: SnackbarType, message: string, duration?: number) => {
      setSnackbarProps({
        type: type,
        message: message,
        duration: duration,
      })
    },
    [],
  )

  const closeSnackbar = useCallback(() => {
    setSnackbarProps(null)
  }, [])

  return (
    <SnackbarContext.Provider value={{ openSnackbar }}>
      {children}
      {snackbarProps && (
        <Snackbar
          type={snackbarProps.type}
          open={!!snackbarProps}
          message={snackbarProps.message}
          duration={snackbarProps.duration}
          onClose={closeSnackbar}
        />
      )}
    </SnackbarContext.Provider>
  )
}

// NOTE: `SnackbarContext` を公開したくないので `useSnackbar()` をここで定義している
export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) {
    throw new Error("useSnackbarContext must be used within SnackbarProvider")
  }
  return ctx
}

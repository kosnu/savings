export type SnackbarType = "success" | "error" | "info" | "warning"

export type OpenSnackbarFn = (
  type: SnackbarType,
  message: string,
  duration?: number,
) => void

export interface SnackbarState {
  type: SnackbarType
  message: string
  duration?: number
}

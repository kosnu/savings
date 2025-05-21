import { useCallback, useState } from "react"

export function useDialog(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const openDialog = useCallback(() => setOpen(true), [])
  const closeDialog = useCallback(() => setOpen(false), [])

  return {
    open: open,
    openDialog: openDialog,
    closeDialog: closeDialog,
  }
}

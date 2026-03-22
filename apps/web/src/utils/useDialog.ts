import { useCallback, useState } from "react"

export function useDialog(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const openDialog = useCallback(() => setOpen(true), [])
  const closeDialog = useCallback(() => setOpen(false), [])
  const onOpenChange = useCallback((nextOpen: boolean) => setOpen(nextOpen), [])

  return {
    open: open,
    setOpen: setOpen,
    onOpenChange: onOpenChange,
    openDialog: openDialog,
    closeDialog: closeDialog,
  }
}

import { useCallback, useState } from "react"

interface UseSidebarReturn {
  open: boolean
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
}

export function useSidebar(defaultOpen: boolean = false): UseSidebarReturn {
  const [open, setOpen] = useState(defaultOpen)

  const toggleSidebar = useCallback(() => {
    setOpen((value) => !value)
  }, [])

  const openSidebar = useCallback(() => {
    setOpen(true)
  }, [])

  const closeSidebar = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, toggleSidebar, openSidebar, closeSidebar }
}

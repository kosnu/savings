import { useCallback, useState } from "react"

interface UseSidebarReturn {
  open: boolean
  toggleSidebar: () => void
}

export function useSidebar(): UseSidebarReturn {
  const [open, setOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setOpen((value) => !value)
  }, [])

  return {
    open: open,
    toggleSidebar: toggleSidebar,
  }
}

import { useCallback, useState } from "react"

interface UseSidebarReturn {
  open: boolean
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
}

export function useSidebar(defaultOpen = false, storageKey?: string): UseSidebarReturn {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === "true" || stored === "false") return stored === "true"
    } catch {
      // 保存値を取得できない場合も既定値で表示する。
    }
    return defaultOpen
  })

  const updateOpen = useCallback(
    (value: boolean) => {
      setOpen(value)
      if (!storageKey) return

      try {
        localStorage.setItem(storageKey, String(value))
      } catch {
        // 保存できなくても現在の画面では開閉できる。
      }
    },
    [storageKey],
  )

  const toggleSidebar = useCallback(() => {
    updateOpen(!open)
  }, [open, updateOpen])

  const openSidebar = useCallback(() => {
    updateOpen(true)
  }, [updateOpen])

  const closeSidebar = useCallback(() => {
    updateOpen(false)
  }, [updateOpen])

  return { open, toggleSidebar, openSidebar, closeSidebar }
}

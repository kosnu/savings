import { useCallback, useEffect, useState } from "react"

interface UseSidebarReturn {
  open: boolean
  toggleSidebar: () => void
  openSidebar: () => void
  closeSidebar: () => void
}

const SIDEBAR_STATE_KEY = "sidebarOpen"

export function useSidebar(defaultOpen: boolean = true): UseSidebarReturn {
  const [open, setOpen] = useState<boolean>(() => {
    // サーバーサイドレンダリング(SSR)中はwindowオブジェクトがないため、エラーを回避します。
    if (typeof window === "undefined") {
      return defaultOpen
    }
    try {
      const item = window.localStorage.getItem(SIDEBAR_STATE_KEY)
      // localStorageに保存された値があればそれを使い、なければデフォルトでfalse（閉じた状態）にします。
      return item ? JSON.parse(item) : defaultOpen
    } catch (error) {
      console.error(error)
      return defaultOpen
    }
  })

  // `open` の状態が変化したら、その値をlocalStorageに保存します。
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(open))
  }, [open])

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

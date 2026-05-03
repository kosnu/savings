import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"

export function useInitializePaymentsMonthSearch() {
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const navigate = useNavigate({ from: "/payments" })
  const { session } = useSupabaseSession()

  useEffect(() => {
    const isPaymentsRoute = pathname === "/payments" || pathname.startsWith("/payments/")
    if (!isPaymentsRoute) return
    // NOTE: セッションがない場合はリダイレクト処理を行わないようにしないと、その後のセッション取得で null になってしまう
    if (!session) return
    if (yearParam && monthParam) return

    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString()

    void navigate({
      to: "/payments",
      search: (prev) => ({ ...prev, year, month }),
      replace: true,
    })
  }, [session, yearParam, monthParam, navigate, pathname])
}

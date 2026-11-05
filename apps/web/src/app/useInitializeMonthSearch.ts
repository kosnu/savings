import { useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { resolveTargetMonth } from "../domain/date"
import { useSupabaseSession } from "../providers/supabase/useSupabaseSession"

export function useInitializeMonthSearch() {
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const navigate = useNavigate()
  const { session } = useSupabaseSession()

  useEffect(() => {
    const isPaymentsRoute =
      pathname === "/" || pathname === "/payments" || pathname.startsWith("/payments/")
    if (!isPaymentsRoute) return
    // NOTE: セッションがない場合はリダイレクト処理を行わないようにしないと、その後のセッション取得で null になってしまう
    if (!session) return
    const targetMonth = resolveTargetMonth(yearParam, monthParam)
    const year = String(targetMonth.year)
    const month = String(targetMonth.month)
    if (yearParam === year && monthParam === month) return

    void navigate({
      to: pathname,
      search: (prev) => ({
        ...prev,
        year,
        month,
      }),
      replace: true,
    })
  }, [session, yearParam, monthParam, navigate, pathname])
}

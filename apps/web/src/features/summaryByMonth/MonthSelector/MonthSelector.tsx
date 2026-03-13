import { useNavigate, useSearch } from "@tanstack/react-router"
import { useCallback, useEffect } from "react"

import { MonthPicker } from "../../../components/inputs/MonthPicker"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"

export function MonthSelector() {
  const { year: yearParam, month: monthParam } = useSearch({
    from: "/authenticated/payments",
  })
  const navigate = useNavigate()
  const { session } = useSupabaseSession()

  // 現在選択されている年月、またはnullの場合は今月
  const currentDate =
    yearParam && monthParam
      ? new Date(Number.parseInt(yearParam, 10), Number.parseInt(monthParam, 10) - 1, 1)
      : null

  const handleMonthChange = useCallback(
    (date: Date | undefined) => {
      if (date) {
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString()
        navigate({ to: "/payments", search: { year, month } })
      }
    },
    [navigate],
  )

  // デフォルトで今月を設定する（クエリパラメータがない場合）
  useEffect(() => {
    // NOTE: セッションがない場合はリダイレクト処理を行わないようにしないと、その後のセッション取得で null になってしまう
    if (!session) return
    if (!yearParam || !monthParam) {
      const now = new Date()
      const year = now.getFullYear().toString()
      const month = (now.getMonth() + 1).toString()
      navigate({ to: "/payments", search: { year, month }, replace: true })
    }
  }, [session, yearParam, monthParam, navigate])

  return <MonthPicker value={currentDate ?? undefined} onChange={handleMonthChange} />
}

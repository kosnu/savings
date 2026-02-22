import { useCallback, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { MonthPicker } from "../../../components/inputs/MonthPicker"
import { paths } from "../../../config/paths"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"

export function MonthSelector() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useSupabaseSession()

  const yearParam = searchParams.get("year")
  const monthParam = searchParams.get("month")

  // 現在選択されている年月、またはnullの場合は今月
  const currentDate =
    yearParam && monthParam
      ? new Date(
          Number.parseInt(yearParam, 10),
          Number.parseInt(monthParam, 10) - 1,
          1,
        )
      : null

  const handleMonthChange = useCallback(
    (date: Date | undefined) => {
      if (date) {
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString()
        navigate(paths.payments.getHref(year, month))
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
      navigate(paths.payments.getHref(year, month), { replace: true })
    }
  }, [session, yearParam, monthParam, navigate])

  return (
    <MonthPicker
      value={currentDate ?? undefined}
      onChange={handleMonthChange}
    />
  )
}

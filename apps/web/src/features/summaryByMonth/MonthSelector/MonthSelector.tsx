import { useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import { MonthPicker } from "../../../components/inputs/MonthPicker"

export function MonthSelector() {
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })
  const navigate = useNavigate({ from: "/payments" })

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
        void navigate({
          to: "/payments",
          search: (prev) => ({ ...prev, year, month }),
        })
      }
    },
    [navigate],
  )

  return <MonthPicker value={currentDate ?? undefined} onChange={handleMonthChange} />
}

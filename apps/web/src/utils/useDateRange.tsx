import { useSearch } from "@tanstack/react-router"
import { endOfMonth, startOfMonth } from "date-fns"
import { useEffect, useState } from "react"

export function useDateRange() {
  const [date, setDate] = useState<Date | null>(null)
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ])
  const { year: yearParam, month: monthParam } = useSearch({
    from: "/authenticated/payments",
  })

  useEffect(() => {
    if (yearParam && monthParam) {
      const year = Number.parseInt(yearParam, 10)
      const month = Number.parseInt(monthParam, 10)
      const date = new Date(year, month - 1, 1)
      setDateRange([startOfMonth(date), endOfMonth(date)])
      setDate(date)
    }
  }, [yearParam, monthParam])

  return {
    dateRange: dateRange,
    date: date,
  }
}

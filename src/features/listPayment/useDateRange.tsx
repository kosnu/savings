import { endOfMonth, startOfMonth } from "date-fns"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

export function useDateRange() {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ])
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const yearParam = searchParams.get("year")
    const monthParam = searchParams.get("month")

    if (yearParam && monthParam) {
      const year = Number.parseInt(yearParam, 10)
      const month = Number.parseInt(monthParam, 10)
      const date = new Date(year, month - 1, 1)
      setDateRange([startOfMonth(date), endOfMonth(date)])
    }
  }, [searchParams])

  return {
    dateRange: dateRange,
  }
}

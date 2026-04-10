import { useSearch } from "@tanstack/react-router"
import { endOfMonth, startOfMonth } from "date-fns"

export function useDateRange() {
  const { year: yearParam, month: monthParam } = useSearch({
    from: "/authenticated/payments",
  })

  const date =
    yearParam && monthParam
      ? new Date(Number.parseInt(yearParam, 10), Number.parseInt(monthParam, 10) - 1, 1)
      : null

  const dateRange: [Date | null, Date | null] = date
    ? [startOfMonth(date), endOfMonth(date)]
    : [null, null]

  return {
    dateRange,
    date,
  }
}

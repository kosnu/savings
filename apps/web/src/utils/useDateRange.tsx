import { useLocation } from "@tanstack/react-router"
import { endOfMonth, startOfMonth } from "date-fns"

import { resolveTargetMonth } from "../domain/date"

export function useDateRange() {
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })

  const { year, month } = resolveTargetMonth(yearParam, monthParam)
  const date = new Date(year, month - 1, 1)
  const dateRange: [Date, Date] = [startOfMonth(date), endOfMonth(date)]

  return {
    dateRange,
    date,
  }
}

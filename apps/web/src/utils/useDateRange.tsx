import { useLocation } from "@tanstack/react-router"
import { endOfMonth, startOfMonth } from "date-fns"

export function useDateRange() {
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })

  const date = parseDateParam(yearParam, monthParam)

  const dateRange: [Date | null, Date | null] = date
    ? [startOfMonth(date), endOfMonth(date)]
    : [null, null]

  return {
    dateRange,
    date,
  }
}

function parseDateParam(yearParam?: string, monthParam?: string): Date | null {
  if (!yearParam || !monthParam) {
    return null
  }

  const year = parseIntegerParam(yearParam)
  const month = parseIntegerParam(monthParam)

  if (year === null || month === null || month < 1 || month > 12) {
    return null
  }

  return new Date(year, month - 1, 1)
}

function parseIntegerParam(param: string): number | null {
  const value = Number(param)

  return Number.isInteger(value) ? value : null
}

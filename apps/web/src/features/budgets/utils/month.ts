import { endOfMonth, format } from "date-fns"

import type { TargetMonth } from "../types"

export function toTargetMonth(date: Date): TargetMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
}

export function toMonthEndIsoDate(date: Date): string {
  return format(endOfMonth(date), "yyyy-MM-dd")
}

export function parseIsoDateOnlyToLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)

  return new Date(year, month - 1, day)
}

export function formatTargetMonthKey(targetMonth: TargetMonth): string {
  return `${targetMonth.year}-${targetMonth.month.toString().padStart(2, "0")}`
}

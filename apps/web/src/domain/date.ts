import { endOfMonth, format } from "date-fns"

export interface TargetMonth {
  year: number
  month: number
}

export function toTargetMonth(date: Date): TargetMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }
}

export function toMonthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function toMonthEndDateOnlyString(date: Date): string {
  return toDateOnlyString(endOfMonth(date))
}

export function toDateOnlyString(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function parseDateOnlyStringToLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)

  return new Date(year, month - 1, day)
}

export function formatTargetMonthKey(targetMonth: TargetMonth): string {
  return `${targetMonth.year}-${targetMonth.month.toString().padStart(2, "0")}`
}

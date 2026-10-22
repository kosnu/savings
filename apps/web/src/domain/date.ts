import { endOfMonth, format } from "date-fns"

export interface TargetMonth {
  year: number
  month: number
}

export const MIN_YEAR = 2022
export const MAX_YEAR = 2032
export const MIN_MONTH_INDEX = MIN_YEAR * 12
export const MAX_MONTH_INDEX = MAX_YEAR * 12 + 11
export const MIN_DATE_ONLY = `${MIN_YEAR}-01-01`
export const MAX_DATE_ONLY = `${MAX_YEAR}-12-31`

export function isSelectableMonth({ year, month }: TargetMonth): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    MIN_YEAR <= year &&
    year <= MAX_YEAR &&
    1 <= month &&
    month <= 12
  )
}

export function isSupportedDate(date: Date): boolean {
  return isSelectableMonth(toTargetMonth(date))
}

export function clampDateToSupportedRange(date: Date): Date {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date")
  if (date.getFullYear() < MIN_YEAR) return new Date(MIN_YEAR, 0, 1)
  if (date.getFullYear() > MAX_YEAR) return new Date(MAX_YEAR, 11, 31)
  return date
}

export function resolveTargetMonth(
  year: string | undefined,
  month: string | undefined,
  now = new Date(),
): TargetMonth {
  const currentMonth = toTargetMonth(now)
  const targetMonth = {
    year: Number(year ?? currentMonth.year),
    month: Number(month ?? currentMonth.month),
  }
  return isSelectableMonth(targetMonth)
    ? targetMonth
    : toTargetMonth(clampDateToSupportedRange(now))
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

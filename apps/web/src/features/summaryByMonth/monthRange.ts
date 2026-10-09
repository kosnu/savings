import type { TargetMonth } from "../../domain/date"

export const MIN_MONTH_INDEX = 2022 * 12
export const MAX_MONTH_INDEX = 2032 * 12 + 11

export function isSelectableMonth({ year, month }: TargetMonth) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return false
  }

  const monthIndex = year * 12 + month - 1
  return MIN_MONTH_INDEX <= monthIndex && monthIndex <= MAX_MONTH_INDEX
}

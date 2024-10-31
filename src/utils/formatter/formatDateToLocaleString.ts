import { format } from "date-fns"

export function formatDateToLocaleString(
  date: Date | string,
  formatStr = "yyyy/MM/dd",
): string {
  return format(date, formatStr)
}

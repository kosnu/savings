import { formatISO } from "date-fns"

export function formatDateToIsoString(date: Date | string): string {
  return formatISO(date, { format: "extended" })
}

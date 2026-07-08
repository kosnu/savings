import { format } from "date-fns"
import { enUS, ja } from "date-fns/locale"

import { getDateFormat, toAppLanguage } from "../../i18n"

const dateFnsLocaleByLanguage = {
  en: enUS,
  ja,
} as const

export function formatDateToLocaleString(
  date: Date | string,
  formatStr = getDateFormat("ja"),
  language = "ja",
): string {
  return format(date, formatStr, {
    locale: dateFnsLocaleByLanguage[toAppLanguage(language)],
  })
}

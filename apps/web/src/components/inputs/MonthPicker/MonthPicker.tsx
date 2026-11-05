import { Flex, Select } from "@radix-ui/themes"
import { useCallback, type ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import {
  clampDateToSupportedRange,
  isSupportedDate,
  MAX_YEAR,
  MIN_YEAR,
  resolveTargetMonth,
} from "../../../domain/date"
import { getDateLocale } from "../../../i18n"

interface MonthPickerProps {
  id?: string
  name?: string
  onChange?: (date: Date | undefined) => void
  size?: ComponentProps<typeof Select.Root>["size"]
  value?: Date
}

const MONTH_VALUES = Array.from({ length: 12 }, (_, i) => i + 1)

const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => {
  const year = MIN_YEAR + i
  return { value: year.toString(), label: year.toString() }
})

export function MonthPicker(props: MonthPickerProps) {
  const { id, name, onChange, size, value } = props
  const { i18n, t } = useTranslation()

  const supportedValue = value && isSupportedDate(value) ? value : undefined
  const currentMonth = supportedValue ? (supportedValue.getMonth() + 1).toString() : ""
  const currentYear = supportedValue ? supportedValue.getFullYear().toString() : ""

  const handleMonthChange = useCallback(
    (month: string) => {
      const targetMonth = resolveTargetMonth(
        currentYear || undefined,
        month,
        clampDateToSupportedRange(new Date()),
      )
      onChange?.(new Date(targetMonth.year, targetMonth.month - 1, 1))
    },
    [currentYear, onChange],
  )

  const handleYearChange = useCallback(
    (year: string) => {
      const targetMonth = resolveTargetMonth(
        year,
        currentMonth || undefined,
        clampDateToSupportedRange(new Date()),
      )
      onChange?.(new Date(targetMonth.year, targetMonth.month - 1, 1))
    },
    [currentMonth, onChange],
  )

  return (
    <Flex gap="2" align="center">
      <Select.Root size={size} value={currentYear} onValueChange={handleYearChange}>
        <Select.Trigger aria-label={t("date.year")} placeholder={t("date.selectYear")} />
        <Select.Content>
          {YEARS.map((year) => (
            <Select.Item key={year.value} value={year.value}>
              {year.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <span>/</span>
      <Select.Root size={size} name={name} value={currentMonth} onValueChange={handleMonthChange}>
        <Select.Trigger aria-label={t("date.month")} id={id} placeholder={t("date.selectMonth")} />
        <Select.Content>
          {MONTH_VALUES.map((month) => (
            <Select.Item key={month} value={month.toString()}>
              {formatMonthLabel(month, i18n.resolvedLanguage)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  )
}

function formatMonthLabel(month: number, language: string | undefined): string {
  return new Intl.DateTimeFormat(getDateLocale(language), { month: "long" }).format(
    new Date(2024, month - 1, 1),
  )
}

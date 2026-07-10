import { Flex, Select } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { getDateLocale } from "../../../i18n"

interface MonthPickerProps {
  id?: string
  name?: string
  onChange?: (date: Date | undefined) => void
  value?: Date
}

const MONTH_VALUES = Array.from({ length: 12 }, (_, i) => i + 1)

const YEARS = Array.from({ length: 11 }, (_, i) => {
  const year = 2022 + i
  return { value: year.toString(), label: year.toString() }
})

export function MonthPicker(props: MonthPickerProps) {
  const { id, name, onChange, value } = props
  const { i18n, t } = useTranslation()

  const currentMonth = value ? (value.getMonth() + 1).toString() : ""
  const currentYear = value ? value.getFullYear().toString() : ""

  const handleMonthChange = useCallback(
    (month: string) => {
      const year = currentYear || new Date().getFullYear().toString()
      const newDate = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, 1)
      onChange?.(newDate)
    },
    [currentYear, onChange],
  )

  const handleYearChange = useCallback(
    (year: string) => {
      const month = currentMonth || (new Date().getMonth() + 1).toString()
      const newDate = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, 1)
      onChange?.(newDate)
    },
    [currentMonth, onChange],
  )

  return (
    <Flex gap="2" align="center">
      <Select.Root value={currentYear} onValueChange={handleYearChange}>
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
      <Select.Root name={name} value={currentMonth} onValueChange={handleMonthChange}>
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

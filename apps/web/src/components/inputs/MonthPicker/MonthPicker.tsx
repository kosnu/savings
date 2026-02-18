import { Flex, Select } from "@radix-ui/themes"
import { useCallback } from "react"

interface MonthPickerProps {
  id?: string
  name?: string
  onChange?: (date: Date | undefined) => void
  value?: Date
}

const MONTHS = [
  { value: "1", label: "1月" },
  { value: "2", label: "2月" },
  { value: "3", label: "3月" },
  { value: "4", label: "4月" },
  { value: "5", label: "5月" },
  { value: "6", label: "6月" },
  { value: "7", label: "7月" },
  { value: "8", label: "8月" },
  { value: "9", label: "9月" },
  { value: "10", label: "10月" },
  { value: "11", label: "11月" },
  { value: "12", label: "12月" },
]

const YEARS = Array.from({ length: 11 }, (_, i) => {
  const year = 2022 + i
  return { value: year.toString(), label: year.toString() }
})

export function MonthPicker(props: MonthPickerProps) {
  const { id, name, onChange, value } = props

  const currentMonth = value ? (value.getMonth() + 1).toString() : ""
  const currentYear = value ? value.getFullYear().toString() : ""

  const handleMonthChange = useCallback(
    (month: string) => {
      const year = currentYear || new Date().getFullYear().toString()
      const newDate = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        1,
      )
      onChange?.(newDate)
    },
    [currentYear, onChange],
  )

  const handleYearChange = useCallback(
    (year: string) => {
      const month = currentMonth || (new Date().getMonth() + 1).toString()
      const newDate = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        1,
      )
      onChange?.(newDate)
    },
    [currentMonth, onChange],
  )

  return (
    <Flex gap="2" align="center">
      <Select.Root value={currentMonth} onValueChange={handleMonthChange}>
        <Select.Trigger id={id} name={name} placeholder="月を選択" />
        <Select.Content>
          {MONTHS.map((month) => (
            <Select.Item key={month.value} value={month.value}>
              {month.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <span>/</span>
      <Select.Root value={currentYear} onValueChange={handleYearChange}>
        <Select.Trigger placeholder="年を選択" />
        <Select.Content>
          {YEARS.map((year) => (
            <Select.Item key={year.value} value={year.value}>
              {year.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Flex>
  )
}

import { Button, Popover, Text } from "@radix-ui/themes"
import { DayPicker } from "react-day-picker"
import { ja } from "react-day-picker/locale"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

import "react-day-picker/style.css"
import { useCallback, useState } from "react"

interface ModeSingleProps {
  mode: "single"
  onChange?: (date: Date | undefined) => void
}

type DatePickerProps = {
  label: React.ReactNode
  name: string
  required?: boolean
  defaultValue?: Date
} & ModeSingleProps

export function DatePicker({
  label,
  name,
  mode,
  defaultValue = undefined,
  onChange,
  ...props
}: DatePickerProps) {
  const [date, setDate] = useState<Date | undefined>(defaultValue)

  const handleChange = useCallback(
    (date: Date | undefined) => {
      setDate(date)
      onChange?.(date)
    },
    [onChange],
  )

  return (
    <label>
      <Text as="div" size="2" mb="1" weight="bold">
        {label}
      </Text>
      <Popover.Root>
        <Popover.Trigger>
          <Button variant="outline">
            {/* TODO: Calendar icon */}
            {date ? formatDateToLocaleString(date) : <span>Pick a date</span>}
          </Button>
        </Popover.Trigger>
        <Popover.Content>
          <DayPicker
            {...props}
            locale={ja}
            mode={mode}
            selected={date}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
      <input
        type="hidden"
        name={name}
        defaultValue={date?.toISOString()}
        required={props.required}
      />
    </label>
  )
}

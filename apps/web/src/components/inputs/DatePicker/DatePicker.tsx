import { CalendarIcon } from "@radix-ui/react-icons"
import { Button, Popover } from "@radix-ui/themes"
import { useCallback, useId, useState } from "react"
import { DayPicker } from "react-day-picker"
import { ja } from "react-day-picker/locale"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { BaseField } from "../BaseField"

import "react-day-picker/style.css"

interface ModeSingleProps {
  mode: "single"
  onChange?: (date: Date | undefined) => void
}

type DatePickerProps = {
  label: React.ReactNode
  name: string
  defaultValue?: Date
  required?: boolean
  error?: { message: string }
  helperText?: string
} & ModeSingleProps

export function DatePicker({
  label,
  name,
  mode,
  defaultValue = undefined,
  required = false,
  error,
  helperText,
  onChange,
  ...props
}: DatePickerProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(defaultValue)

  const handleTriggerClick = useCallback(() => {
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (date: Date | undefined) => {
      setDate(date)
      onChange?.(date)
      setOpen(false)
    },
    [onChange],
  )

  const handleFocusOut = useCallback(() => {
    setOpen(false)
  }, [])

  const handleEscapeKeyDown = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <BaseField
      label={label}
      htmlFor={id}
      required={required}
      error={Boolean(error)}
      message={helperText}
      width="fit-content"
      {...props}
    >
      <Popover.Root open={open}>
        <Popover.Trigger onClick={handleTriggerClick}>
          <Button id={id} variant="outline">
            <CalendarIcon width="18" height="18" />
            {date ? formatDateToLocaleString(date) : <span>Pick a date</span>}
          </Button>
        </Popover.Trigger>
        <Popover.Content
          onFocusOutside={handleFocusOut}
          onEscapeKeyDown={handleEscapeKeyDown}
        >
          <DayPicker
            {...props}
            locale={ja}
            mode={mode}
            selected={date}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
      <input type="hidden" name={name} defaultValue={date?.toISOString()} />
    </BaseField>
  )
}

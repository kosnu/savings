import { CalendarIcon } from "@radix-ui/react-icons"
import { Button, Popover } from "@radix-ui/themes"
import { useCallback, useEffect, useState } from "react"
import { DayPicker } from "react-day-picker"
import { ja } from "react-day-picker/locale"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

import "react-day-picker/style.css"

interface ModeSingleProps {
  onChange?: (date: Date | undefined) => void
  value?: Date
}

type DatePickerProps = {
  id?: string
  name?: string
  defaultValue?: Date
} & ModeSingleProps

export function DatePicker({
  id,
  name,
  defaultValue = undefined,
  value,
  onChange,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [internalDate, setInternalDate] = useState<Date | undefined>(
    value ?? defaultValue,
  )

  // Sync internal state with controlled value
  useEffect(() => {
    if (value !== undefined) {
      setInternalDate(value)
    }
  }, [value])

  const displayDate = value ?? internalDate

  const handleTriggerClick = useCallback(() => {
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (date: Date | undefined) => {
      setInternalDate(date)
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
    <div>
      <Popover.Root open={open}>
        <Popover.Trigger onClick={handleTriggerClick}>
          <Button id={id} variant="outline" color="gray">
            <CalendarIcon width="18" height="18" />
            {displayDate ? (
              formatDateToLocaleString(displayDate)
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Content
          onFocusOutside={handleFocusOut}
          onEscapeKeyDown={handleEscapeKeyDown}
        >
          <DayPicker
            {...props}
            locale={ja}
            mode="single"
            selected={displayDate}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
      <input
        type="hidden"
        name={name}
        value={displayDate?.toISOString() ?? ""}
      />
    </div>
  )
}

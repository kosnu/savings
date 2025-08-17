import { CalendarIcon } from "@radix-ui/react-icons"
import { Button, Popover } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { DayPicker } from "react-day-picker"
import { ja } from "react-day-picker/locale"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

import "react-day-picker/style.css"

interface ModeSingleProps {
  onChange?: (date: Date | undefined) => void
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
  onChange,
  ...props
}: DatePickerProps) {
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
    <div>
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
            mode="single"
            selected={date}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
      <input type="hidden" name={name} defaultValue={date?.toISOString()} />
    </div>
  )
}

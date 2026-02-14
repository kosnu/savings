import { CalendarIcon } from "@radix-ui/react-icons"
import { Button, Popover } from "@radix-ui/themes"
import { useCallback, useState } from "react"
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
  // Internal state only used in uncontrolled mode
  const [uncontrolledDate, setUncontrolledDate] = useState<Date | undefined>(
    defaultValue,
  )

  // Determine if component is controlled
  // A DatePicker is controlled when both value and onChange are provided
  const isControlled = onChange !== undefined && value !== undefined
  const displayDate = isControlled ? value : uncontrolledDate

  const handleTriggerClick = useCallback(() => {
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (date: Date | undefined) => {
      // Update internal state only in uncontrolled mode
      if (!isControlled) {
        setUncontrolledDate(date)
      }
      onChange?.(date)
      setOpen(false)
    },
    [onChange, isControlled],
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
      {isControlled ? (
        <input
          type="hidden"
          name={name}
          value={displayDate?.toISOString() ?? ""}
        />
      ) : (
        displayDate && (
          <input
            type="hidden"
            name={name}
            defaultValue={displayDate.toISOString()}
          />
        )
      )}
    </div>
  )
}

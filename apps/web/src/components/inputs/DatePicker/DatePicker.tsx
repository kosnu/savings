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

export function DatePicker(props: DatePickerProps) {
  const { id, name, defaultValue = undefined, onChange, ...restProps } = props
  const [open, setOpen] = useState(false)
  const [uncontrolledDate, setUncontrolledDate] = useState<Date | undefined>(
    defaultValue,
  )

  const isControlled = "value" in props
  const displayDate = isControlled ? props.value : uncontrolledDate

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
            {...restProps}
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
        <input
          type="hidden"
          name={name}
          defaultValue={displayDate?.toISOString() ?? ""}
        />
      )}
    </div>
  )
}

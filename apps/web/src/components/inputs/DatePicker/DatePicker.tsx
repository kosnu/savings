import { CalendarIcon } from "@radix-ui/react-icons"
import { Popover, TextField } from "@radix-ui/themes"
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
  const {
    id,
    name,
    defaultValue = undefined,
    onChange,
    value,
    ...restProps
  } = props
  const [open, setOpen] = useState(false)

  const handleTriggerClick = useCallback(() => {
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (date: Date | undefined) => {
      // Update internal state only in uncontrolled mode
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
          <div>
            <TextField.Root
              id={id}
              name={name}
              placeholder="Pick a date"
              value={value ? formatDateToLocaleString(value) : undefined}
            >
              <TextField.Slot>
                <CalendarIcon width="18" height="18" />
              </TextField.Slot>
            </TextField.Root>
          </div>
        </Popover.Trigger>
        <Popover.Content
          onFocusOutside={handleFocusOut}
          onEscapeKeyDown={handleEscapeKeyDown}
        >
          <DayPicker
            {...restProps}
            locale={ja}
            mode="single"
            selected={value}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
    </div>
  )
}

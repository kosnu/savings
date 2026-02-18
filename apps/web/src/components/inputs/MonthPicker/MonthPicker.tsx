import { CalendarIcon } from "@radix-ui/react-icons"
import { Popover, TextField } from "@radix-ui/themes"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { useCallback, useState } from "react"
import { DayPicker } from "react-day-picker"
import { ja as jaLocale } from "react-day-picker/locale"

import "react-day-picker/style.css"

interface MonthPickerProps {
  id?: string
  name?: string
  onChange?: (date: Date | undefined) => void
  value?: Date
}

export function MonthPicker(props: MonthPickerProps) {
  const { id, name, onChange, value } = props
  const [open, setOpen] = useState(false)

  const handleTriggerClick = useCallback(() => {
    setOpen(true)
  }, [])

  const handleChange = useCallback(
    (date: Date | undefined) => {
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

  const formattedValue = value ? format(value, "yyyy年M月", { locale: ja }) : ""

  return (
    <div>
      <Popover.Root open={open}>
        <Popover.Trigger onClick={handleTriggerClick}>
          <div>
            <TextField.Root
              id={id}
              name={name}
              placeholder="年月を選択"
              value={formattedValue}
              readOnly
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
            locale={jaLocale}
            mode="single"
            selected={value}
            onSelect={handleChange}
            captionLayout="dropdown-months"
            fromYear={2020}
            toYear={2030}
          />
        </Popover.Content>
      </Popover.Root>
    </div>
  )
}

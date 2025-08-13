import { Button, Flex, Popover, Text } from "@radix-ui/themes"
import { DayPicker } from "react-day-picker"
import { ja } from "react-day-picker/locale"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

import "react-day-picker/style.css"
import { CalendarIcon } from "@radix-ui/react-icons"
import { useCallback, useId, useState } from "react"

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
  const buttonId = useId()
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
    <Flex direction="column" gap="1" width="fit-content">
      <Text as="label" htmlFor={buttonId} size="2" weight="bold">
        {label}
      </Text>
      <Popover.Root open={open}>
        <Popover.Trigger onClick={handleTriggerClick}>
          <Button id={buttonId} variant="outline">
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
      <input
        type="hidden"
        name={name}
        defaultValue={date?.toISOString()}
        required={props.required}
      />
    </Flex>
  )
}

import { DayPicker } from "@daypicker/react"
import { CalendarIcon } from "@radix-ui/react-icons"
import { Popover, TextField } from "@radix-ui/themes"
import { isSameDay } from "date-fns"
import { enUS, ja } from "date-fns/locale"
import { type ComponentProps, type KeyboardEvent, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { getDateFormat, toAppLanguage } from "../../../i18n"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

import "@daypicker/react/style.css"

interface ModeSingleProps {
  onChange?: (date: Date | undefined) => void
  value?: Date
}

type DatePickerProps = {
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  name?: string
  onEscapeKeyDown?: () => void
  required?: boolean
  size?: ComponentProps<typeof TextField.Root>["size"]
} & ModeSingleProps

export function DatePicker(props: DatePickerProps) {
  const { i18n, t } = useTranslation()
  const {
    autoFocus,
    disabled,
    id,
    name,
    onChange,
    onEscapeKeyDown,
    required,
    size,
    value,
    ...restProps
  } = props
  const [open, setOpen] = useState(() => Boolean(autoFocus && !disabled))
  const sameDayClickRef = useRef(false)
  const language = toAppLanguage(i18n.resolvedLanguage)

  const handleTriggerClick = useCallback(() => {
    if (disabled) return
    setOpen(true)
  }, [disabled])

  const handleChange = useCallback(
    (date: Date | undefined) => {
      if (sameDayClickRef.current && date && value && isSameDay(date, value)) {
        sameDayClickRef.current = false
        return
      }

      sameDayClickRef.current = false
      onChange?.(date)
      setOpen(false)
    },
    [onChange, value],
  )

  const handleDayClick = useCallback(
    (day: Date) => {
      if (!required || !value || !isSameDay(day, value)) {
        return
      }

      sameDayClickRef.current = true
      onChange?.(day)
      setOpen(false)
    },
    [onChange, required, value],
  )

  const handleFocusOut = useCallback(() => {
    setOpen(false)
  }, [])

  const handleEscapeKeyDown = useCallback(() => {
    setOpen(false)
    onEscapeKeyDown?.()
  }, [onEscapeKeyDown])

  const handleInputChange = useCallback(() => {
    // 入力欄は日付表示専用で、値変更はカレンダー選択でのみ受け付ける。
    // `readOnly` は既存の見た目に影響するため使わず、controlled input 警告の抑止だけを行う。
  }, [])

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Escape") return

      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      onEscapeKeyDown?.()
    },
    [onEscapeKeyDown],
  )

  return (
    <div>
      <Popover.Root open={open}>
        <Popover.Trigger onClick={handleTriggerClick}>
          <div>
            <TextField.Root
              autoFocus={autoFocus}
              disabled={disabled}
              id={id}
              name={name}
              placeholder={t("date.pick")}
              size={size}
              value={
                value ? formatDateToLocaleString(value, getDateFormat(language), language) : ""
              }
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
            >
              <TextField.Slot>
                <CalendarIcon width="18" height="18" />
              </TextField.Slot>
            </TextField.Root>
          </div>
        </Popover.Trigger>
        <Popover.Content onFocusOutside={handleFocusOut} onEscapeKeyDown={handleEscapeKeyDown}>
          <DayPicker
            {...restProps}
            locale={language === "ja" ? ja : enUS}
            mode="single"
            required={required}
            selected={value}
            onDayClick={handleDayClick}
            onSelect={handleChange}
          />
        </Popover.Content>
      </Popover.Root>
    </div>
  )
}

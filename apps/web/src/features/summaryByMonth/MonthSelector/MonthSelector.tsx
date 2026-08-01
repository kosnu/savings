import { ChevronLeftIcon, ChevronRightIcon, Cross1Icon } from "@radix-ui/react-icons"
import { Button, Flex, IconButton, Popover, Text } from "@radix-ui/themes"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { MonthPicker } from "../../../components/inputs/MonthPicker"
import { getDateLocale } from "../../../i18n"
import { useDateRange } from "../../../utils/useDateRange"

const MIN_MONTH_INDEX = toMonthIndex(2022, 1)
const MAX_MONTH_INDEX = toMonthIndex(2032, 12)

function toMonthIndex(year: number, month: number) {
  return year * 12 + month - 1
}

function getMonthIndex(date: Date) {
  return toMonthIndex(date.getFullYear(), date.getMonth() + 1)
}

function isAllowedMonth(date: Date) {
  const monthIndex = getMonthIndex(date)
  return MIN_MONTH_INDEX <= monthIndex && monthIndex <= MAX_MONTH_INDEX
}

export function MonthSelector() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { date: parsedDate } = useDateRange()
  const navigate = useNavigate({ from: "/payments" })

  // 未指定や不正な年月は、URLの初期化・検証処理に任せる。
  const currentDate = parsedDate && isAllowedMonth(parsedDate) ? parsedDate : null
  const currentMonthIndex = currentDate ? getMonthIndex(currentDate) : null
  const currentMonthLabel = currentDate
    ? new Intl.DateTimeFormat(getDateLocale(i18n.resolvedLanguage), {
        year: "numeric",
        month: "long",
      }).format(currentDate)
    : t("date.selectYearMonth")
  const isPreviousMonthDisabled = currentMonthIndex !== null && currentMonthIndex <= MIN_MONTH_INDEX
  const isNextMonthDisabled = currentMonthIndex !== null && currentMonthIndex >= MAX_MONTH_INDEX

  const handleMonthChange = useCallback(
    (date: Date | undefined) => {
      if (date && isAllowedMonth(date)) {
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString()
        void navigate({
          to: "/payments",
          search: (prev) => ({ ...prev, year, month }),
        })
      }
    },
    [navigate],
  )

  const handlePreviousMonthClick = useCallback(() => {
    const baseDate = currentDate ?? new Date()
    handleMonthChange(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1))
  }, [currentDate, handleMonthChange])

  const handleNextMonthClick = useCallback(() => {
    const baseDate = currentDate ?? new Date()
    handleMonthChange(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1))
  }, [currentDate, handleMonthChange])

  const handleOverlayMonthChange = useCallback(
    (date: Date | undefined) => {
      if (!date || !isAllowedMonth(date)) return

      handleMonthChange(date)
      setOpen(false)
    },
    [handleMonthChange],
  )

  return (
    <Flex align="center" gap="3">
      <IconButton
        aria-label={t("date.previousMonth")}
        size="2"
        type="button"
        variant="ghost"
        disabled={isPreviousMonthDisabled}
        onClick={handlePreviousMonthClick}
      >
        <ChevronLeftIcon />
      </IconButton>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          <Button type="button" size="3" variant="ghost">
            {currentMonthLabel}
          </Button>
        </Popover.Trigger>
        <Popover.Content aria-label={t("date.selectYearMonth")}>
          <Flex direction="column" gap="4">
            <Flex align="center" justify="between" gap="3">
              <Text weight="bold">{t("date.selectYearMonth")}</Text>
              <Popover.Close>
                <IconButton
                  aria-label={t("common.close", { target: t("date.selectYearMonth") })}
                  size="2"
                  type="button"
                  variant="ghost"
                >
                  <Cross1Icon />
                </IconButton>
              </Popover.Close>
            </Flex>
            <Flex justify="center">
              <MonthPicker
                size="3"
                value={currentDate ?? undefined}
                onChange={handleOverlayMonthChange}
              />
            </Flex>
          </Flex>
        </Popover.Content>
      </Popover.Root>
      <IconButton
        aria-label={t("date.nextMonth")}
        size="2"
        type="button"
        variant="ghost"
        disabled={isNextMonthDisabled}
        onClick={handleNextMonthClick}
      >
        <ChevronRightIcon />
      </IconButton>
    </Flex>
  )
}

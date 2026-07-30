import { ChevronLeftIcon, ChevronRightIcon, Cross1Icon } from "@radix-ui/react-icons"
import { Button, Dialog, Flex, IconButton } from "@radix-ui/themes"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { MonthPicker } from "../../../components/inputs/MonthPicker"
import { getDateLocale } from "../../../i18n"

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
  const yearParam = useLocation({
    select: (location) => location.search.year,
  })
  const monthParam = useLocation({
    select: (location) => location.search.month,
  })
  const navigate = useNavigate({ from: "/payments" })

  // 現在選択されている年月。未指定の場合は初期化処理に任せる。
  const currentDate = useMemo(
    () =>
      yearParam && monthParam
        ? new Date(Number.parseInt(yearParam, 10), Number.parseInt(monthParam, 10) - 1, 1)
        : null,
    [monthParam, yearParam],
  )
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

  return (
    <Flex align="center" gap="2">
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
      <Dialog.Root>
        <Dialog.Trigger>
          <Button type="button" size="3" variant="ghost">
            {currentMonthLabel}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content aria-describedby={undefined} maxWidth="24rem">
          <Flex align="center" justify="between" gap="3">
            <Dialog.Title mb="0">{t("date.selectYearMonth")}</Dialog.Title>
            <Dialog.Close>
              <IconButton
                aria-label={t("common.close", { target: t("date.selectYearMonth") })}
                type="button"
                size="2"
                variant="ghost"
              >
                <Cross1Icon aria-hidden />
              </IconButton>
            </Dialog.Close>
          </Flex>
          <Flex justify="center" mt="4">
            <MonthPicker size="3" value={currentDate ?? undefined} onChange={handleMonthChange} />
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
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

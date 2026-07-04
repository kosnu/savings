import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons"
import { Flex, IconButton } from "@radix-ui/themes"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useMemo } from "react"

import { MonthPicker } from "../../../components/inputs/MonthPicker"

export function MonthSelector() {
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

  const handleMonthChange = useCallback(
    (date: Date | undefined) => {
      if (date) {
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
        aria-label="Previous month"
        size="2"
        type="button"
        variant="ghost"
        onClick={handlePreviousMonthClick}
      >
        <ChevronLeftIcon />
      </IconButton>
      <MonthPicker value={currentDate ?? undefined} onChange={handleMonthChange} />
      <IconButton
        aria-label="Next month"
        size="2"
        type="button"
        variant="ghost"
        onClick={handleNextMonthClick}
      >
        <ChevronRightIcon />
      </IconButton>
    </Flex>
  )
}

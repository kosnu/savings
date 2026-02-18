import { Flex, Text } from "@radix-ui/themes"
import { useCallback, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { MonthPicker } from "../../../components/inputs/MonthPicker"
import { paths } from "../../../config/paths"

export function MonthSelector() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const yearParam = searchParams.get("year")
  const monthParam = searchParams.get("month")

  // 現在選択されている年月、またはnullの場合は今月
  const currentDate =
    yearParam && monthParam
      ? new Date(
          Number.parseInt(yearParam, 10),
          Number.parseInt(monthParam, 10) - 1,
          1,
        )
      : null

  const handleMonthChange = useCallback(
    (date: Date | undefined) => {
      if (date) {
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString()
        navigate(paths.payments.getHref(year, month))
      }
    },
    [navigate],
  )

  // デフォルトで今月を設定する（クエリパラメータがない場合）
  useEffect(() => {
    if (!yearParam || !monthParam) {
      const now = new Date()
      const year = now.getFullYear().toString()
      const month = (now.getMonth() + 1).toString()
      navigate(paths.payments.getHref(year, month), { replace: true })
    }
  }, [yearParam, monthParam, navigate])

  return (
    <Flex gap="2" direction="column">
      <MonthPicker
        value={currentDate ?? undefined}
        onChange={handleMonthChange}
      />
      <Text size="2" color="gray">
        Month
      </Text>
    </Flex>
  )
}

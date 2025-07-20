import { Flex, Grid } from "@radix-ui/themes"
import { useMemo } from "react"
import { useDateRange } from "../../../utils/useDateRange"
import { MoneyCard } from "../MoneyCard"
import { useGetTotalExpenditures } from "../useGetTotalExpenditures"
import { useGetTotalIncome } from "../useGetTotalIncome"

export function Summary() {
  const { dateRange } = useDateRange()
  const { getTotalExpenditures } = useGetTotalExpenditures()
  const { getTotalIncome } = useGetTotalIncome()

  const getTotalExpendituresPromise = useMemo(
    () => getTotalExpenditures(dateRange),
    [getTotalExpenditures, dateRange],
  )
  const getTotalIncomePromise = useMemo(
    () => getTotalIncome(dateRange),
    [getTotalIncome, dateRange],
  )

  return (
    <Flex gap="3" width="100%">
      <Grid columns="2" gap="3" width="100%">
        <MoneyCard
          title="Expenditures"
          getValue={getTotalExpendituresPromise}
        />
        <MoneyCard title="Income" getValue={getTotalIncomePromise} />
      </Grid>
      {/* TODO: カテゴリ別の合計金額を表示する */}
    </Flex>
  )
}

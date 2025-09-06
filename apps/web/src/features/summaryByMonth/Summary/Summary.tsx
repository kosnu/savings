import { Flex, Grid } from "@radix-ui/themes"
import { useMemo } from "react"
import { useDateRange } from "../../../utils/useDateRange"
import { MoneyCard } from "../MoneyCard"
import { useGetTotalExpenditures } from "../useGetTotalExpenditures"

export function Summary() {
  const { dateRange } = useDateRange()
  const { getTotalExpenditures } = useGetTotalExpenditures()

  const getTotalExpendituresPromise = useMemo(
    () => getTotalExpenditures(dateRange),
    [getTotalExpenditures, dateRange],
  )

  return (
    <Flex gap="3" width="100%">
      <Grid columns="2" gap="3" width="100%">
        <MoneyCard
          title="Expenditures"
          getValue={getTotalExpendituresPromise}
        />
      </Grid>
      {/* TODO: カテゴリ別の合計金額を表示する */}
    </Flex>
  )
}

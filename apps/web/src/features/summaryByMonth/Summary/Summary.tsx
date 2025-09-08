import { Flex, Grid } from "@radix-ui/themes"
import { MonthlyTotals } from "../MonthlyTotals"

export function Summary() {
  return (
    <Flex gap="3" width="100%">
      <Grid columns="2" gap="3" width="100%">
        <MonthlyTotals />
      </Grid>
      {/* TODO: カテゴリ別の合計金額を表示する */}
    </Flex>
  )
}

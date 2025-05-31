import { Flex, Grid } from "@radix-ui/themes"
import { MoneyCard } from "../MoneyCard"

export function Summary() {
  const expenditures = 999999
  const income = 1000000

  return (
    <Flex gap="3" width="100%">
      <Grid columns="2" gap="3" width="100%">
        <MoneyCard title="Expenditures" value={expenditures} />
        <MoneyCard title="Income" value={income} />
      </Grid>
      {/* TODO: カテゴリ別の合計金額を表示する */}
    </Flex>
  )
}

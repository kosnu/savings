import { Card, DataList, Grid } from "@radix-ui/themes"
import { splitArray } from "../../../utils/splitArray"
import { toCurrency } from "../../../utils/toCurrency"
import { useCategoryTotals } from "./useCategoryTotals"

const defaultChunkSize = 2

interface CategoryTotalsProps {
  chunkSize?: number
}

export function CategoryTotals({
  chunkSize = defaultChunkSize,
}: CategoryTotalsProps) {
  const { categoryTotals } = useCategoryTotals()

  // カテゴリが多い場合に縦に長くなりすぎないよう、2列に分割して表示する
  const categoryChunks = splitArray(Object.entries(categoryTotals), chunkSize)

  return (
    <Card size="2">
      <Grid columns={`${chunkSize}`} gap="2" width="100%">
        {categoryChunks.map((chunk, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: indexをkeyに使うのはやむを得ない
          <DataList.Root key={i} aria-label={`Category totals chunk ${i}`}>
            {chunk.map(([label, value]) => (
              <DataList.Item key={label} align="center">
                <DataList.Label minWidth="80px">{label}</DataList.Label>
                <DataList.Value>{toCurrency(value)}</DataList.Value>
              </DataList.Item>
            ))}
          </DataList.Root>
        ))}
      </Grid>
    </Card>
  )
}

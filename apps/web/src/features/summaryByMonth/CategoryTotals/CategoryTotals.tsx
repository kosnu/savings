import { DataList, Grid } from "@radix-ui/themes"

import { splitArray } from "../../../utils/splitArray"
import { toCurrency } from "../../../utils/toCurrency"
import { useCategoryTotals } from "./useCategoryTotals"

const defaultChunkSize = 2

interface CategoryTotalsProps {
  cacheScope?: string
  chunkSize?: number
}

export function CategoryTotals({ cacheScope, chunkSize = defaultChunkSize }: CategoryTotalsProps) {
  const { categoryTotals } = useCategoryTotals({ cacheScope })
  const categoryEntries = Object.entries(categoryTotals)

  if (categoryEntries.length === 0) {
    return null
  }

  // カテゴリが多い場合に縦に長くなりすぎないよう、2列に分割して表示する
  const categoryChunks = splitArray(categoryEntries, chunkSize)

  return (
    <Grid columns={`${chunkSize}`} gap="2" width="100%">
      {categoryChunks.map((chunk, i) => (
        <DataList.Root
          key={chunk.map(([categoryKey]) => categoryKey).join(":")}
          aria-label={`Category totals chunk ${i}`}
        >
          {chunk.map(([categoryKey, total]) => (
            <DataList.Item key={categoryKey} align="center">
              <DataList.Label minWidth="80px">{total.categoryName}</DataList.Label>
              <DataList.Value>{toCurrency(total.totalAmount)}</DataList.Value>
            </DataList.Item>
          ))}
        </DataList.Root>
      ))}
    </Grid>
  )
}

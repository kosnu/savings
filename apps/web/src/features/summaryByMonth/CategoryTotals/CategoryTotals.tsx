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
          key={chunk.map(([label]) => label).join(":")}
          aria-label={`Category totals chunk ${i}`}
        >
          {chunk.map(([label, value]) => (
            <DataList.Item key={label} align="center">
              <DataList.Label minWidth="80px">{label}</DataList.Label>
              <DataList.Value>{toCurrency(value)}</DataList.Value>
            </DataList.Item>
          ))}
        </DataList.Root>
      ))}
    </Grid>
  )
}

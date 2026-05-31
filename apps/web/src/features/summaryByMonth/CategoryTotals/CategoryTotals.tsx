import { Button, DataList, Flex, Grid } from "@radix-ui/themes"
import { useState } from "react"

import { splitArray } from "../../../utils/splitArray"
import { toCurrency } from "../../../utils/toCurrency"
import type { CategoryTotals as CategoryTotalsData } from "./fetchCategoryTotals"
import { useCategoryTotals } from "./useCategoryTotals"

const defaultChunkSize = 2
const initialVisibleCount = 3

interface CategoryTotalsProps {
  cacheScope?: string
  chunkSize?: number
}

export function CategoryTotals({ cacheScope, chunkSize = defaultChunkSize }: CategoryTotalsProps) {
  const { categoryTotals, targetMonthKey } = useCategoryTotals({ cacheScope })

  if (categoryTotals.length === 0) {
    return null
  }

  const categoryTotalsKey = [
    targetMonthKey,
    ...categoryTotals.map(
      (total) => `${total.key}:${total.kind}:${total.totalAmount}:${total.pinned ? "1" : "0"}`,
    ),
  ].join(":")

  return (
    <CategoryTotalsContent
      key={categoryTotalsKey}
      categoryTotals={categoryTotals}
      chunkSize={chunkSize}
    />
  )
}

interface CategoryTotalsContentProps {
  categoryTotals: CategoryTotalsData
  chunkSize: number
}

function CategoryTotalsContent({ categoryTotals, chunkSize }: CategoryTotalsContentProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)

  const visibleTotals = categoryTotals.slice(0, visibleCount)
  const hiddenCount = categoryTotals.length - visibleTotals.length
  // カテゴリが多い場合に縦に長くなりすぎないよう、2列に分割して表示する
  const categoryChunks = splitArray(visibleTotals, chunkSize)

  return (
    <Flex direction="column" gap="2" width="100%">
      <Grid columns={`${chunkSize}`} gap="2" width="100%">
        {categoryChunks.map((chunk, i) => (
          <DataList.Root
            key={chunk.map((total) => total.key).join(":")}
            aria-label={`Category totals chunk ${i}`}
          >
            {chunk.map((total) => (
              <DataList.Item key={total.key} align="center">
                <DataList.Label minWidth="80px">{total.categoryName}</DataList.Label>
                <DataList.Value>{toCurrency(total.totalAmount)}</DataList.Value>
              </DataList.Item>
            ))}
          </DataList.Root>
        ))}
      </Grid>
      {hiddenCount > 0 && (
        <Flex justify="start">
          <Button
            type="button"
            variant="soft"
            size="1"
            aria-label="Show more category totals"
            onClick={() => setVisibleCount(categoryTotals.length)}
          >
            Show more
          </Button>
        </Flex>
      )}
    </Flex>
  )
}

import { Button, DataList, Flex, Grid, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"

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
  return (
    <ErrorBoundary fallback={<Text color="red">Failed</Text>}>
      <Suspense fallback={<CategoryTotalsLoading chunkSize={chunkSize} />}>
        <CategoryTotalsResolved cacheScope={cacheScope} chunkSize={chunkSize} />
      </Suspense>
    </ErrorBoundary>
  )
}

function CategoryTotalsResolved({
  cacheScope,
  chunkSize,
}: {
  cacheScope?: string
  chunkSize: number
}) {
  const { promise, targetMonthKey } = useCategoryTotals({ cacheScope })
  const categoryTotals = use(promise)

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

function CategoryTotalsLoading({ chunkSize }: { chunkSize: number }) {
  const skeletonChunks = splitArray(["primary", "secondary", "tertiary"], chunkSize)

  return (
    <Grid columns={`${chunkSize}`} gap="1" width="100%" aria-label="loading category totals">
      {skeletonChunks.map((chunk) => (
        <DataList.Root
          key={chunk.join(":")}
          size="1"
          aria-label={`Loading category totals chunk ${chunk.join(" ")}`}
        >
          {chunk.map((row) => (
            <DataList.Item key={row} align="center">
              <DataList.Label minWidth="80px">
                <Skeleton loading>
                  <Text aria-hidden>Category</Text>
                </Skeleton>
              </DataList.Label>
              <DataList.Value>
                <Skeleton loading>
                  <Text aria-hidden>￥0,000</Text>
                </Skeleton>
              </DataList.Value>
            </DataList.Item>
          ))}
        </DataList.Root>
      ))}
    </Grid>
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
    <Flex direction="column" gap="3" width="100%">
      <Grid columns={`${chunkSize}`} gap="1" width="100%">
        {categoryChunks.map((chunk, i) => (
          <DataList.Root
            key={chunk.map((total) => total.key).join(":")}
            size="1"
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

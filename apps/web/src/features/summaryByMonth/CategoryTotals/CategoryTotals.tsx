import { Box, Button, Flex, Grid, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use, useState, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../utils/toCurrency"
import type { CategoryTotals as CategoryTotalsData } from "./fetchCategoryTotals"
import { useCategoryTotals } from "./useCategoryTotals"

import styles from "./CategoryTotals.module.css"

const initialVisibleCount = 3

interface CategoryTotalsProps {
  cacheScope?: string
}

export function CategoryTotals({ cacheScope }: CategoryTotalsProps) {
  const { promise, targetMonthKey } = useCategoryTotals({ cacheScope })

  return (
    <ErrorBoundary
      fallback={<Text color="red">Failed</Text>}
      resetKeys={[cacheScope ?? "default", targetMonthKey]}
    >
      <Suspense fallback={<CategoryTotalsLoading />}>
        <CategoryTotalsResolved promise={promise} targetMonthKey={targetMonthKey} />
      </Suspense>
    </ErrorBoundary>
  )
}

function CategoryTotalsResolved({
  promise,
  targetMonthKey,
}: {
  promise: Promise<CategoryTotalsData>
  targetMonthKey: string
}) {
  const categoryTotals = use(promise)

  if (categoryTotals.length === 0) {
    return null
  }

  const categoryTotalsKey = [
    targetMonthKey,
    ...categoryTotals.map(
      (total) =>
        `${total.key}:${total.kind}:${total.totalAmount}:${total.budgetStatus}:${total.budgetAmount ?? "none"}:${total.pinned ? "1" : "0"}`,
    ),
  ].join(":")

  return <CategoryTotalsContent key={categoryTotalsKey} categoryTotals={categoryTotals} />
}

function CategoryTotalsLoading() {
  return (
    <Flex aria-label="loading category totals" direction="column" gap="2" width="100%">
      {["primary", "secondary", "tertiary"].map((row) => (
        <CategoryTotalsGrid key={row}>
          <Skeleton loading>
            <Text aria-hidden>Category</Text>
          </Skeleton>
          <Skeleton loading>
            <Text aria-hidden>￥0,000</Text>
          </Skeleton>
          <Skeleton loading>
            <Text aria-hidden>￥0,000 left</Text>
          </Skeleton>
        </CategoryTotalsGrid>
      ))}
    </Flex>
  )
}

interface CategoryTotalsContentProps {
  categoryTotals: CategoryTotalsData
}

function CategoryTotalsContent({ categoryTotals }: CategoryTotalsContentProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)

  const hasOverflow = categoryTotals.length > initialVisibleCount
  const isExpanded = visibleCount >= categoryTotals.length
  const visibleTotals = categoryTotals.slice(0, visibleCount)
  const toggleLabel = isExpanded ? "Show less" : "Show more"
  const toggleAriaLabel = isExpanded ? "Show less category totals" : "Show more category totals"

  return (
    <Flex direction="column" gap="3" width="100%">
      <Box display={{ initial: "none", sm: "block" }}>
        <CategoryTotalsGrid>
          <Text color="gray">Category</Text>
          <Text align="right" color="gray">
            Total
          </Text>
          <Text align="right" color="gray">
            Difference
          </Text>
        </CategoryTotalsGrid>
      </Box>
      <Flex direction="column" gap="2" width="100%">
        {visibleTotals.map((total) => (
          <CategoryTotalsGrid key={total.key}>
            <CategoryTotalName total={total} />
            <CategoryTotalAmount amount={total.totalAmount} />
            <CategoryBudgetDifference total={total} />
          </CategoryTotalsGrid>
        ))}
      </Flex>
      {hasOverflow && (
        <Flex justify="center">
          <Button
            type="button"
            variant="ghost"
            color="gray"
            size="2"
            aria-label={toggleAriaLabel}
            onClick={() =>
              setVisibleCount(isExpanded ? initialVisibleCount : categoryTotals.length)
            }
          >
            {toggleLabel}
          </Button>
        </Flex>
      )}
    </Flex>
  )
}

function CategoryTotalsGrid({ children }: { children: ReactNode }) {
  return <Grid className={styles.row}>{children}</Grid>
}

function CategoryTotalName({ total }: { total: CategoryTotalsData[number] }) {
  return (
    <Flex align="center" gap="2">
      <Text className={total.kind === "uncategorized" ? styles.systemLabel : undefined}>
        {total.categoryName}
      </Text>
    </Flex>
  )
}

function CategoryTotalAmount({ amount }: { amount: number }) {
  return (
    <Text align="right" className={styles.amount}>
      {toCurrency(amount)}
    </Text>
  )
}

function CategoryBudgetDifference({ total }: { total: CategoryTotalsData[number] }) {
  const text = formatBudgetDifference(total)

  const color = getBudgetDifferenceColor(total)

  return (
    <Text align="right" className={styles.difference} color={color} size="1">
      {text}
    </Text>
  )
}

function formatBudgetDifference(total: CategoryTotalsData[number]): string {
  if (total.budgetStatus === "none") {
    return "No budget"
  }

  if (total.budgetStatus === "unset") {
    return "Not set"
  }

  const difference = total.budgetDifference

  if (difference === null) {
    return "Failed"
  }

  if (difference > 0) {
    return `${toCurrency(difference)} left`
  }

  if (difference < 0) {
    return `${toCurrency(Math.abs(difference))} over`
  }

  return "On budget"
}

function getBudgetDifferenceColor(
  total: CategoryTotalsData[number],
): "gray" | "green" | "yellow" | "red" {
  if (total.budgetStatus === "none" || total.budgetStatus === "unset") {
    return "gray"
  }

  if (total.budgetDifference === null) {
    return "red"
  }

  if (total.budgetDifference > 0) {
    return "green"
  }

  if (total.budgetDifference < 0) {
    return "yellow"
  }

  return "gray"
}

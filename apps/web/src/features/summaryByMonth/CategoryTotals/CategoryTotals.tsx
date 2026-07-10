import { Box, Button, Flex, Grid, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use, useState, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { i18next } from "../../../i18n"
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
  const { t } = useTranslation()

  return (
    <ErrorBoundary
      fallback={<Text color="red">{t("common.failed")}</Text>}
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
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("summary.loadingCategoryTotals")} direction="column" gap="2" width="100%">
      {["primary", "secondary", "tertiary"].map((row) => (
        <CategoryTotalsGrid key={row}>
          <Skeleton loading>
            <Text aria-hidden>{t("summary.category")}</Text>
          </Skeleton>
          <Skeleton loading>
            <Text aria-hidden>¥0,000</Text>
          </Skeleton>
          <Skeleton loading>
            <Text aria-hidden>¥0,000 left</Text>
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
  const { t } = useTranslation()

  const hasOverflow = categoryTotals.length > initialVisibleCount
  const isExpanded = visibleCount >= categoryTotals.length
  const visibleTotals = categoryTotals.slice(0, visibleCount)
  const toggleLabel = isExpanded ? t("summary.showLess") : t("summary.showMore")
  const toggleAriaLabel = isExpanded ? t("summary.showLessAria") : t("summary.showMoreAria")

  return (
    <Flex direction="column" gap="3" width="100%">
      <Box display={{ initial: "none", sm: "block" }}>
        <CategoryTotalsGrid>
          <Text color="gray">{t("summary.category")}</Text>
          <Text align="right" color="gray">
            {t("summary.total")}
          </Text>
          <Text align="right" color="gray">
            {t("summary.difference")}
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
  const { t } = useTranslation()
  const categoryName =
    total.kind === "uncategorized" ? t("payments.category.uncategorized") : total.categoryName

  return (
    <Flex align="center" gap="2">
      <Text className={total.kind === "uncategorized" ? styles.systemLabel : undefined}>
        {categoryName}
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
    return i18next.t("common.noBudget")
  }

  if (total.budgetStatus === "unset") {
    return i18next.t("common.notSet")
  }

  const difference = total.budgetDifference

  if (difference === null) {
    return i18next.t("common.failed")
  }

  if (difference > 0) {
    return i18next.t("common.left", { amount: toCurrency(difference) })
  }

  if (difference < 0) {
    return i18next.t("common.over", { amount: toCurrency(Math.abs(difference)) })
  }

  return i18next.t("common.onBudget")
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

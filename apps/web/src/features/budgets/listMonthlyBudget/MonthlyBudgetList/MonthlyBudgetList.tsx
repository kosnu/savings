import { Flex, Skeleton, Table, Text } from "@radix-ui/themes"
import { Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../../utils/toCurrency"
import type { MonthlyBudget } from "../../types"
import { useMonthlyBudgets } from "../useMonthlyBudgets"

const monthlyBudgetListLimit = 10

export function MonthlyBudgetList() {
  const { promise } = useMonthlyBudgets(monthlyBudgetListLimit)
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="4" weight="medium">
        {t("budgets.title")}
      </Text>
      <Table.Root aria-label={t("budgets.title")}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{t("date.month")}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">{t("amount.label")}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <ErrorBoundary fallback={<StatusRow color="red" text={t("budgets.loadError")} />}>
            <Suspense fallback={<LoadingRows />}>
              <MonthlyBudgetRows promise={promise} />
            </Suspense>
          </ErrorBoundary>
        </Table.Body>
      </Table.Root>
    </Flex>
  )
}

function MonthlyBudgetRows({ promise }: { promise: Promise<MonthlyBudget[]> }) {
  const monthlyBudgets = use(promise)
  const { t } = useTranslation()

  if (monthlyBudgets.length === 0) {
    return <StatusRow color="gray" text={t("budgets.empty")} />
  }

  return monthlyBudgets.map((monthlyBudget) => (
    <MonthlyBudgetRow key={monthlyBudget.id} monthlyBudget={monthlyBudget} />
  ))
}

function LoadingRows() {
  return (
    <>
      <LoadingRow />
      <LoadingRow />
      <LoadingRow />
    </>
  )
}

function LoadingRow() {
  const { t } = useTranslation()

  return (
    <Table.Row aria-label={t("budgets.loadingList")}>
      <Table.Cell>
        <Skeleton loading>
          <Text>0000/00</Text>
        </Skeleton>
      </Table.Cell>
      <Table.Cell align="right">
        <Skeleton loading>
          <Text>¥000,000</Text>
        </Skeleton>
      </Table.Cell>
    </Table.Row>
  )
}

function StatusRow({ color, text }: { color: "gray" | "red"; text: string }) {
  return (
    <Table.Row>
      <Table.Cell colSpan={2}>
        <Text color={color}>{text}</Text>
      </Table.Cell>
    </Table.Row>
  )
}

function MonthlyBudgetRow({ monthlyBudget }: { monthlyBudget: MonthlyBudget }) {
  return (
    <Table.Row>
      <Table.RowHeaderCell>{formatMonthlyBudgetMonth(monthlyBudget)}</Table.RowHeaderCell>
      <Table.Cell align="right">{toCurrency(monthlyBudget.amount)}</Table.Cell>
    </Table.Row>
  )
}

function formatMonthlyBudgetMonth(monthlyBudget: MonthlyBudget): string {
  return `${monthlyBudget.effectiveYear}/${String(monthlyBudget.effectiveMonth).padStart(2, "0")}`
}

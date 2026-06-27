import { Pencil1Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons"
import { Button, Flex, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../../utils/toCurrency"
import { CreateMonthlyBudgetModal } from "../../createMonthlyBudget/CreateMonthlyBudgetModal"
import { useEffectiveMonthlyBudget } from "../../getMonthlyBudget/useEffectiveMonthlyBudget"
import { RemoveMonthlyBudgetModal } from "../../removeMonthlyBudget/RemoveMonthlyBudgetModal"
import type { MonthlyBudget, MonthlyBudgetState } from "../../types"
import { UpdateMonthlyBudgetModal } from "../../updateMonthlyBudget/UpdateMonthlyBudgetModal"

export function LatestMonthlyBudget() {
  const targetMonth = new Date()
  const { promise } = useEffectiveMonthlyBudget(targetMonth)

  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="4" weight="medium">
        Monthly Budgets
      </Text>
      <ErrorBoundary
        fallback={
          <Text color="red" role="alert">
            Could not load monthly budgets.
          </Text>
        }
      >
        <Suspense fallback={<LatestMonthlyBudgetLoading />}>
          <LatestMonthlyBudgetContent promise={promise} targetMonth={targetMonth} />
        </Suspense>
      </ErrorBoundary>
    </Flex>
  )
}

function LatestMonthlyBudgetContent({
  promise,
  targetMonth,
}: {
  promise: Promise<MonthlyBudgetState>
  targetMonth: Date
}) {
  const monthlyBudgetState = use(promise)

  if (monthlyBudgetState.status !== "amount") {
    return (
      <CreateMonthlyBudgetModal
        trigger={
          <Button variant="soft">
            <PlusIcon /> Create budget
          </Button>
        }
      />
    )
  }

  return (
    <LatestMonthlyBudgetRow
      monthlyBudget={monthlyBudgetState.monthlyBudget}
      targetMonth={targetMonth}
    />
  )
}

function LatestMonthlyBudgetLoading() {
  return (
    <Flex aria-label="loading latest monthly budget" align="center" justify="between" gap="3">
      <Skeleton loading>
        <Text>￥000,000</Text>
      </Skeleton>
    </Flex>
  )
}

function LatestMonthlyBudgetRow({
  monthlyBudget,
  targetMonth,
}: {
  monthlyBudget: MonthlyBudget
  targetMonth: Date
}) {
  return (
    <Flex align="center" justify="between" gap="3">
      <Text>{toCurrency(monthlyBudget.amount)}</Text>
      <Flex gap="2">
        <UpdateMonthlyBudgetModal
          monthlyBudget={monthlyBudget}
          targetMonth={targetMonth}
          trigger={
            <Button variant="soft">
              <Pencil1Icon /> Edit budget
            </Button>
          }
        />
        <RemoveMonthlyBudgetModal
          targetMonth={targetMonth}
          trigger={
            <Button color="red" variant="soft">
              <TrashIcon /> Remove budget
            </Button>
          }
        />
      </Flex>
    </Flex>
  )
}

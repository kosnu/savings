import { Pencil1Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons"
import { Button, Flex, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../../utils/toCurrency"
import { CreateMonthlyBudgetModal } from "../../createMonthlyBudget/CreateMonthlyBudgetModal"
import { useEffectiveMonthlyBudget } from "../../getMonthlyBudget/useEffectiveMonthlyBudget"
import { RemoveMonthlyBudgetModal } from "../../removeMonthlyBudget/RemoveMonthlyBudgetModal"
import type { MonthlyBudget, MonthlyBudgetState } from "../../types"
import { UpdateMonthlyBudgetModal } from "../../updateMonthlyBudget/UpdateMonthlyBudgetModal"

export function LatestMonthlyBudget() {
  const { promise } = useEffectiveMonthlyBudget(new Date())
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="4" weight="medium">
        {t("budgets.title")}
      </Text>
      <ErrorBoundary
        fallback={
          <Text color="red" role="alert">
            {t("budgets.loadError")}
          </Text>
        }
      >
        <Suspense fallback={<LatestMonthlyBudgetLoading />}>
          <LatestMonthlyBudgetContent promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </Flex>
  )
}

function LatestMonthlyBudgetContent({ promise }: { promise: Promise<MonthlyBudgetState> }) {
  const monthlyBudgetState = use(promise)
  const { t } = useTranslation()

  if (monthlyBudgetState.status !== "amount") {
    return (
      <CreateMonthlyBudgetModal
        trigger={
          <Button variant="soft">
            <PlusIcon /> {t("budgets.create")}
          </Button>
        }
      />
    )
  }

  return <LatestMonthlyBudgetRow monthlyBudget={monthlyBudgetState.monthlyBudget} />
}

function LatestMonthlyBudgetLoading() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("budgets.loadingLatest")} align="center" justify="between" gap="3">
      <Skeleton loading>
        <Text>¥000,000</Text>
      </Skeleton>
    </Flex>
  )
}

function LatestMonthlyBudgetRow({ monthlyBudget }: { monthlyBudget: MonthlyBudget }) {
  const { t } = useTranslation()

  return (
    <Flex align="center" justify="between" gap="3">
      <Text>{toCurrency(monthlyBudget.amount)}</Text>
      <Flex gap="2">
        <UpdateMonthlyBudgetModal
          monthlyBudget={monthlyBudget}
          trigger={
            <Button variant="soft">
              <Pencil1Icon /> {t("budgets.edit")}
            </Button>
          }
        />
        <RemoveMonthlyBudgetModal
          trigger={
            <Button color="red" variant="soft">
              <TrashIcon /> {t("budgets.remove")}
            </Button>
          }
        />
      </Flex>
    </Flex>
  )
}

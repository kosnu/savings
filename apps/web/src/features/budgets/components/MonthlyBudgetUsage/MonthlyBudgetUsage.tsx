import { Skeleton, Text } from "@radix-ui/themes"
import { memo } from "react"

import { useEffectiveMonthlyBudget } from "../../getMonthlyBudget/useEffectiveMonthlyBudget"
import {
  getMonthlyBudgetUsageDisplay,
  type MonthlyBudgetUsageStatus,
} from "../../utils/monthlyBudgetUsage"

export interface MonthlyBudgetUsageProps {
  targetDate: Date | null
  totalExpenditures: number | null
  totalExpendituresError: Error | null
  totalExpendituresLoading: boolean
}

export function MonthlyBudgetUsage({
  targetDate,
  totalExpenditures,
  totalExpendituresError,
  totalExpendituresLoading,
}: MonthlyBudgetUsageProps) {
  const {
    data: monthlyBudgetState,
    error: monthlyBudgetError,
    loading: monthlyBudgetLoading,
  } = useEffectiveMonthlyBudget(targetDate)

  if (totalExpendituresLoading || monthlyBudgetLoading) {
    return <MonthlyBudgetUsageText loading />
  }

  if (totalExpendituresError || targetDate === null || totalExpenditures === null) {
    return null
  }

  if (monthlyBudgetError) {
    return <MonthlyBudgetUsageText error />
  }

  const display = getMonthlyBudgetUsageDisplay(
    totalExpenditures,
    monthlyBudgetState.status === "amount" ? monthlyBudgetState.monthlyBudget.amount : null,
  )

  if (display === null) {
    return null
  }

  return <MonthlyBudgetUsageText status={display.status} text={display.text} />
}

interface MonthlyBudgetUsageTextProps {
  error?: boolean
  loading?: boolean
  status?: MonthlyBudgetUsageStatus
  text?: string
}

const MonthlyBudgetUsageText = memo(function MonthlyBudgetUsageText({
  error = false,
  loading = false,
  status,
  text,
}: MonthlyBudgetUsageTextProps) {
  const content = error ? "Failed" : (text ?? "\u00A0")

  return (
    <Skeleton loading={loading} data-testid={loading ? "budget-difference-skeleton" : undefined}>
      <Text
        align="right"
        aria-hidden={loading}
        color={getTextColor(error, status)}
        role={error ? "status" : undefined}
        size="2"
        style={{ display: "inline-block", minHeight: "20px", minWidth: "12ch" }}
      >
        {content}
      </Text>
    </Skeleton>
  )
})

function getTextColor(error: boolean, status?: MonthlyBudgetUsageStatus): "green" | "red" | "gray" {
  if (error) {
    return "gray"
  }

  if (status === "remaining") {
    return "green"
  }

  if (status === "over") {
    return "red"
  }

  return "gray"
}

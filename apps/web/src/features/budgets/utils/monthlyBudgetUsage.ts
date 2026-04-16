import { toCurrency } from "../../../utils/toCurrency"

export type MonthlyBudgetUsageStatus = "remaining" | "over"

export interface MonthlyBudgetUsageDisplay {
  text: string
  status: MonthlyBudgetUsageStatus
}

export function getMonthlyBudgetUsageDisplay(
  totalExpenditures: number | null,
  monthlyBudgetAmount: number | null,
): MonthlyBudgetUsageDisplay | null {
  if (totalExpenditures === null || monthlyBudgetAmount === null) {
    return null
  }

  const difference = monthlyBudgetAmount - totalExpenditures

  if (difference >= 0) {
    return {
      text: `${toCurrency(difference)} left`,
      status: "remaining",
    }
  }

  return {
    text: `${toCurrency(Math.abs(difference))} over`,
    status: "over",
  }
}

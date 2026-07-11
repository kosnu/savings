import { Progress } from "@radix-ui/themes"

interface BudgetProgressProps {
  amount: number
  ariaLabel: string
  ariaValueText: string
  budget: number
  status: "remaining" | "over"
}

export function BudgetProgress({
  amount,
  ariaLabel,
  ariaValueText,
  budget,
  status,
}: BudgetProgressProps) {
  const max = budget > 0 ? budget : 1
  const value = budget > 0 ? Math.min(amount, budget) : amount === 0 ? 0 : 1

  return (
    <Progress
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      color={status === "over" ? "yellow" : "green"}
      max={max}
      size="2"
      value={value}
    />
  )
}

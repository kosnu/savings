import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import type { MonthlyBudget } from "../../types"
import { UpdateMonthlyBudgetForm } from "../UpdateMonthlyBudgetForm"

interface UpdateMonthlyBudgetModalProps {
  monthlyBudget: MonthlyBudget
  targetMonth: Date
  trigger?: ReactElement
}

export function UpdateMonthlyBudgetModal({
  monthlyBudget,
  targetMonth,
  trigger = <Button>Edit budget</Button>,
}: UpdateMonthlyBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()

  const handleSuccess = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={trigger}
      title="Edit monthly budget"
      description="Update this month's budget amount."
    >
      <UpdateMonthlyBudgetForm
        monthlyBudget={monthlyBudget}
        targetMonth={targetMonth}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}

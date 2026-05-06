import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import type { MonthlyBudget } from "../../types"
import { UpdateMonthlyBudgetForm } from "../UpdateMonthlyBudgetForm"

interface UpdateMonthlyBudgetModalProps {
  monthlyBudget: MonthlyBudget
  trigger?: ReactElement
}

export function UpdateMonthlyBudgetModal({
  monthlyBudget,
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
      description="Update the latest monthly budget amount."
    >
      <UpdateMonthlyBudgetForm
        monthlyBudget={monthlyBudget}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}

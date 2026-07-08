import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"
import { useTranslation } from "react-i18next"

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
  trigger,
}: UpdateMonthlyBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { t } = useTranslation()

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
      trigger={trigger ?? <Button>{t("budgets.edit")}</Button>}
      title={t("budgets.editTitle")}
      description={t("budgets.editDescription")}
    >
      <UpdateMonthlyBudgetForm
        monthlyBudget={monthlyBudget}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}

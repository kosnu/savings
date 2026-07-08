import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { captureMonthlyBudgetCreateError } from "../../../../lib/sentry"
import { useDialog } from "../../../../utils/useDialog"
import { CreateMonthlyBudgetForm } from "../CreateMonthlyBudgetForm"

interface CreateMonthlyBudgetModalProps {
  trigger?: ReactElement
}

export function CreateMonthlyBudgetModal({ trigger }: CreateMonthlyBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { t } = useTranslation()

  const handleSuccess = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleError = useCallback((error: unknown) => {
    captureMonthlyBudgetCreateError(error)
  }, [])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={trigger ?? <Button>{t("budgets.create")}</Button>}
      title={t("budgets.createTitle")}
      description={t("budgets.createDescription")}
    >
      <CreateMonthlyBudgetForm
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}

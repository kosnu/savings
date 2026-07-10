import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex } from "@radix-ui/themes"
import { useCallback, useState, type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { translateMessage } from "../../../../i18n/translateMessage"
import { useDialog } from "../../../../utils/useDialog"
import { useRemoveMonthlyBudget } from "../useRemoveMonthlyBudget"

const REMOVE_MONTHLY_BUDGET_ERROR_MESSAGE = "budgets.removeFailed"

interface RemoveMonthlyBudgetModalProps {
  trigger?: ReactElement
}

export function RemoveMonthlyBudgetModal({ trigger }: RemoveMonthlyBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { t } = useTranslation()
  const { removeMonthlyBudget, isPending } = useRemoveMonthlyBudget()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const handleRemove = useCallback(async () => {
    if (isPending) return

    try {
      setSubmitErrorMessage(undefined)
      await removeMonthlyBudget()
      closeDialog()
    } catch {
      setSubmitErrorMessage(REMOVE_MONTHLY_BUDGET_ERROR_MESSAGE)
    }
  }, [closeDialog, isPending, removeMonthlyBudget])

  const handleCancel = useCallback(() => {
    if (isPending) return

    closeDialog()
  }, [closeDialog, isPending])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={trigger ?? <Button color="red">{t("budgets.remove")}</Button>}
      title={t("budgets.removeTitle")}
      description={t("budgets.removeDescription")}
    >
      <Flex direction="column" gap="4">
        {submitErrorMessage ? (
          <Callout.Root aria-live="polite" role="alert" color="red" variant="surface" size="1">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{translateMessage(t, submitErrorMessage)}</Callout.Text>
          </Callout.Root>
        ) : null}
        <Flex gap="3" justify="end">
          <CancelButton disabled={isPending} onClick={handleCancel} />
          <Button color="red" loading={isPending} onClick={() => void handleRemove()}>
            {t("common.remove")}
          </Button>
        </Flex>
      </Flex>
    </ResponsiveOverlay>
  )
}

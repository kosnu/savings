import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex } from "@radix-ui/themes"
import { useCallback, useState, type ReactElement } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { useRemoveMonthlyBudget } from "../useRemoveMonthlyBudget"

const REMOVE_MONTHLY_BUDGET_ERROR_MESSAGE = "Failed to remove monthly budget."

interface RemoveMonthlyBudgetModalProps {
  trigger?: ReactElement
}

export function RemoveMonthlyBudgetModal({
  trigger = <Button color="red">Remove budget</Button>,
}: RemoveMonthlyBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
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
      trigger={trigger}
      title="Remove this month's budget?"
      description="This month and future months will have no budget until you create a new one. Past months keep their budget history."
    >
      <Flex direction="column" gap="4">
        {submitErrorMessage ? (
          <Callout.Root aria-live="polite" role="alert" color="red" variant="surface" size="1">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{submitErrorMessage}</Callout.Text>
          </Callout.Root>
        ) : null}
        <Flex gap="3" justify="end">
          <CancelButton disabled={isPending} onClick={handleCancel} />
          <Button color="red" loading={isPending} onClick={() => void handleRemove()}>
            Remove
          </Button>
        </Flex>
      </Flex>
    </ResponsiveOverlay>
  )
}

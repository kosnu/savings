import { Button, Flex, Separator } from "@radix-ui/themes"
import { useEffect, useState } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { AmountField } from "../AmountField"
import { CategoryField } from "../CategoryField"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"

interface PaymentDetailsOverlayProps {
  category: Category | null
  payment: Payment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete?: () => void
}

export function PaymentDetailsOverlay({
  category,
  payment,
  open,
  onOpenChange,
  onDelete,
}: PaymentDetailsOverlayProps) {
  const [isEditingField, setIsEditingField] = useState(false)

  function handleEscapeKeyDown(event: KeyboardEvent) {
    if (!isEditingField) return
    event.preventDefault()
  }

  useEffect(() => {
    if (open) return

    setIsEditingField(false)
  }, [open])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      onEscapeKeyDown={handleEscapeKeyDown}
      title="Payment details"
      description="Review the payment details."
    >
      {payment && category ? (
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="4">
            <PaymentDateField date={payment.date} />
            <CategoryField categoryName={category.name} />
            <NoteField note={payment.note} />
            <AmountField
              paymentId={payment.id}
              amount={payment.amount}
              onEditingChange={setIsEditingField}
            />
          </Flex>
          {onDelete ? (
            <>
              <Separator size="4" />
              <Flex justify="end" pt="2">
                <Button color="red" variant="soft" onClick={onDelete}>
                  Delete this payment
                </Button>
              </Flex>
            </>
          ) : null}
        </Flex>
      ) : null}
    </ResponsiveOverlay>
  )
}

import { Button, Flex, Separator } from "@radix-ui/themes"
import { useEffect, useState } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import type { Payment, PaymentDetails, PaymentId } from "../../../../types/payment"
import { unknownCategory } from "../../../categories/unknownCategory"
import { AmountField } from "../AmountField"
import { CategoryField } from "../CategoryField"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { usePaymentDetails } from "../usePaymentDetails"

interface PaymentDetailsOverlayProps {
  paymentId: PaymentId | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete?: (payment: Payment) => void
}

export function PaymentDetailsOverlay({
  paymentId,
  open,
  onOpenChange,
  onDelete,
}: PaymentDetailsOverlayProps) {
  const { data: payment, isLoading } = usePaymentDetails(paymentId)
  const [isEditingField, setIsEditingField] = useState(false)
  const isNotFound = !isLoading && paymentId !== null && payment === null

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
      description={isNotFound ? "Payment not found." : "Review the payment details."}
    >
      {payment ? (
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="4">
            <PaymentDateField date={payment.date} />
            <CategoryField categoryName={payment.category?.name ?? unknownCategory.name} />
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
                <Button color="red" variant="soft" onClick={() => onDelete(toPayment(payment))}>
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

function toPayment(payment: PaymentDetails): Payment {
  return {
    id: payment.id,
    categoryId: payment.category?.id ?? null,
    note: payment.note,
    amount: payment.amount,
    date: payment.date,
    userId: payment.userId,
    createdDate: payment.createdDate,
    updatedDate: payment.updatedDate,
  }
}

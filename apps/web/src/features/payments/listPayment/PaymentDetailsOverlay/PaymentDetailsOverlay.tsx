import { Button, Flex, Separator, Strong, Text } from "@radix-ui/themes"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"

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
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Payment details"
      description={payment ? "Review the payment details." : undefined}
    >
      {payment && category ? (
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="4">
            <DetailField label="Date" value={formatDateToLocaleString(payment.date)} />
            <DetailField label="Category" value={category.name} />
            <DetailField label="Note" value={payment.note} />
            <DetailField label="Amount" value={toCurrency(payment.amount)} weight="bold" />
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

interface DetailFieldProps {
  label: string
  value: string
  align?: "left" | "right"
  weight?: "regular" | "bold"
}

function DetailField({ label, value, align = "left", weight = "regular" }: DetailFieldProps) {
  const hasValue = value.trim().length > 0
  const displayValue = hasValue ? value : "No note"

  return (
    <Flex direction="column" gap="2">
      <Text size="2" color="gray">
        {label}
      </Text>
      <Text
        size="4"
        align={align}
        color={hasValue ? undefined : "gray"}
        style={{ minHeight: "1.75rem", fontStyle: hasValue ? "normal" : "italic" }}
      >
        {weight === "bold" ? <Strong>{displayValue}</Strong> : displayValue}
      </Text>
    </Flex>
  )
}

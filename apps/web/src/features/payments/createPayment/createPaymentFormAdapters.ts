import { clampDateToSupportedRange } from "../../../domain/date"
import type { PaymentWriteInput } from "../paymentFormMappers"
import type { PaymentFormSubmitValues, PaymentFormValues } from "../paymentFormSchema"

export function createPaymentDefaultValues(): PaymentFormValues {
  return {
    date: clampDateToSupportedRange(new Date()),
    category: "",
    note: "",
    amount: undefined,
  }
}

export function mapSubmitFormValuesToPaymentWriteInput(
  value: PaymentFormSubmitValues,
): PaymentWriteInput {
  return {
    categoryId: value.category,
    date: value.date,
    note: value.note,
    amount: value.amount,
  }
}

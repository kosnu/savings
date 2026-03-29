import type { PaymentWriteInput } from "../paymentFormMappers"
import type { FormSchema, SubmitFormSchema } from "./formSchema"

export function createPaymentDefaultValues(): FormSchema {
  return {
    date: new Date(),
    category: "",
    note: "",
    amount: undefined,
  }
}

export function mapSubmitFormValuesToPaymentWriteInput(value: SubmitFormSchema): PaymentWriteInput {
  return {
    categoryId: value.category,
    date: value.date,
    note: value.note,
    amount: value.amount,
  }
}

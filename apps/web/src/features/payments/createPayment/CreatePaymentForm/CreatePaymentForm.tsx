import { Flex } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import z from "zod"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountField } from "../AmountField/AmountField"
import { CategoryField } from "../CategoryField"
import { type FormError, formShema } from "../formSchema"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { useCreatePayment } from "../useCreatePayment"

interface CreatePaymentFormProps {
  onSuccess?: () => void
  onError?: (error?: Error) => void
  onCancel: () => void
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
}: CreatePaymentFormProps) {
  const { createPayment } = useCreatePayment(onSuccess, onError)

  const [error, setError] = useState<FormError>()

  const dateError = error?.fieldErrors.date
  const categoryError = error?.fieldErrors.category
  const noteError = error?.fieldErrors.note
  const amountError = error?.fieldErrors.amount

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      // 5秒待機する
      await new Promise((resolve) => setTimeout(resolve, 5000))
      const formObject = Object.fromEntries(formData.entries())
      const result = formShema.safeParse(formObject)
      if (result.error) {
        setError(z.flattenError(result.error))
        return
      }
      await createPayment({
        categoryId: result.data.category,
        date: result.data.date,
        note: result.data.note,
        amount: result.data.amount,
      })
    },
    [createPayment],
  )

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onCancel()
    },
    [onCancel],
  )

  return (
    <form action={handleSubmit}>
      <Flex direction="column" gap="3">
        <PaymentDateField error={!!dateError?.length} messages={dateError} />
        <CategoryField
          error={!!categoryError?.length}
          messages={categoryError}
        />
        <NoteField error={!!noteError?.length} messages={noteError} />
        <AmountField error={!!amountError?.length} messages={amountError} />
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <CancelButton onClick={handleCancel} />
        <SubmitButton>Create payment</SubmitButton>
      </Flex>
    </form>
  )
}

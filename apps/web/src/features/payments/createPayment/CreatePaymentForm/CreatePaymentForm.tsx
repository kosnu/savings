import { Flex } from "@radix-ui/themes"
import { useCallback, useEffect, useRef, useState } from "react"
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
  onResetReady?: (resetFn: () => void) => void
  additionalActions?: React.ReactNode
  formId?: string
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
  onResetReady,
  additionalActions,
  formId = "create-payment-form",
}: CreatePaymentFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const { createPayment } = useCreatePayment(onSuccess, onError)

  const [error, setError] = useState<FormError>()

  const resetForm = useCallback(() => {
    formRef.current?.reset()
    setError(undefined)
  }, [])

  useEffect(() => {
    onResetReady?.(resetForm)
  }, [onResetReady, resetForm])

  const dateError = error?.fieldErrors.date
  const categoryError = error?.fieldErrors.category
  const noteError = error?.fieldErrors.note
  const amountError = error?.fieldErrors.amount

  const handleSubmit = useCallback(
    async (formData: FormData) => {
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
    <>
      <form ref={formRef} action={handleSubmit} id={formId}>
        <Flex direction="column" gap="3">
          <PaymentDateField error={!!dateError?.length} messages={dateError} />
          <CategoryField
            error={!!categoryError?.length}
            messages={categoryError}
          />
          <NoteField error={!!noteError?.length} messages={noteError} />
          <AmountField error={!!amountError?.length} messages={amountError} />
        </Flex>
      </form>
      <Flex gap="3" mt="4" justify="between" align="center">
        <Flex gap="2" align="center">
          {additionalActions}
        </Flex>
        <Flex gap="3">
          <CancelButton onClick={handleCancel} />
          <SubmitButton type="submit" form={formId}>
            Create
          </SubmitButton>
        </Flex>
      </Flex>
    </>
  )
}

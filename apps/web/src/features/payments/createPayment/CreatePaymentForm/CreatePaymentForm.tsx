import { Checkbox, Flex, Text } from "@radix-ui/themes"
import { type ForwardedRef, forwardRef, useCallback, useState } from "react"
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
  onSuccess?: (keepOpen: boolean) => void
  onError?: (error?: Error) => void
  onCancel: () => void
}

export const CreatePaymentForm = forwardRef(
  (
    { onSuccess, onError, onCancel }: CreatePaymentFormProps,
    ref: ForwardedRef<HTMLFormElement>,
  ) => {
    const [keepOpen, setKeepOpen] = useState(false)
    const [error, setError] = useState<FormError>()

    const handleCreateSuccess = useCallback(() => {
      onSuccess?.(keepOpen)
    }, [onSuccess, keepOpen])

    const { createPayment, isPending } = useCreatePayment(
      handleCreateSuccess,
      onError,
    )

    const dateError = error?.fieldErrors.date
    const categoryError = error?.fieldErrors.category
    const noteError = error?.fieldErrors.note
    const amountError = error?.fieldErrors.amount

    const handleSubmit = useCallback(
      async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
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
      <form ref={ref} onSubmit={handleSubmit}>
        <Flex direction="column" gap="3">
          <PaymentDateField error={!!dateError?.length} messages={dateError} />
          <CategoryField
            error={!!categoryError?.length}
            messages={categoryError}
          />
          <NoteField error={!!noteError?.length} messages={noteError} />
          <AmountField error={!!amountError?.length} messages={amountError} />
        </Flex>
        <Flex gap="3" mt="4" justify="between" align="center">
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={keepOpen}
                onCheckedChange={(checked) => setKeepOpen(checked === true)}
              />
              Keep dialog open after creation
            </Flex>
          </Text>
          <Flex gap="3">
            <CancelButton onClick={handleCancel} />
            <SubmitButton loading={isPending}>Create payment</SubmitButton>
          </Flex>
        </Flex>
      </form>
    )
  },
)

CreatePaymentForm.displayName = "CreatePaymentForm"

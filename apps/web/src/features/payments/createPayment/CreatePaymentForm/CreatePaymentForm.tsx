import { Checkbox, Flex, Text } from "@radix-ui/themes"
import { useCallback, useId, useRef, useState } from "react"
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
  onSuccess?: (shouldClose: boolean) => void
  onError?: (error?: Error) => void
  onCancel: () => void
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
}: CreatePaymentFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const checkboxId = useId()
  const [continuousMode, setContinuousMode] = useState(false)
  const [error, setError] = useState<FormError>()

  const handleSuccessWithContinuousMode = useCallback(() => {
    // Always call onSuccess to notify parent of successful submission
    // Pass shouldClose flag based on continuous mode
    onSuccess?.(!continuousMode)

    if (continuousMode) {
      // Reset the form for continuous creation
      formRef.current?.reset()
      setError(undefined)
    }
  }, [continuousMode, onSuccess])

  const { createPayment } = useCreatePayment(
    handleSuccessWithContinuousMode,
    onError,
  )

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
    <form ref={formRef} action={handleSubmit}>
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
        <Text as="label" size="2" htmlFor={checkboxId}>
          <Flex gap="2" align="center">
            <Checkbox
              id={checkboxId}
              checked={continuousMode}
              onCheckedChange={(checked) => setContinuousMode(checked === true)}
            />
            Continue creating
          </Flex>
        </Text>
        <Flex gap="3">
          <CancelButton onClick={handleCancel} />
          <SubmitButton>Create payment</SubmitButton>
        </Flex>
      </Flex>
    </form>
  )
}

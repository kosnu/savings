import { Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useEffect } from "react"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountField } from "../AmountField/AmountField"
import { CategoryField } from "../CategoryField"
import { type FormSchema, submitFormShema } from "../formSchema"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { useCreatePayment } from "../useCreatePayment"

interface CreatePaymentFormProps {
  onSuccess?: () => void
  onError?: (error?: Error) => void
  onCancel: () => void
  onResetReady?: (resetFn: () => void) => void
}

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return undefined
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
  onResetReady,
}: CreatePaymentFormProps) {
  const { createPayment } = useCreatePayment(onSuccess, onError)

  const defaultValues: FormSchema = {
    date: new Date(),
    category: "",
    note: "",
    amount: undefined,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: submitFormShema,
    },
    onSubmit: async ({ value }) => {
      const parsedValue = submitFormShema.parse(value)

      await createPayment({
        categoryId: parsedValue.category,
        date: parsedValue.date,
        note: parsedValue.note,
        amount: parsedValue.amount,
      })
    },
  })

  const resetForm = useCallback(() => {
    form.reset()
  }, [form])

  useEffect(() => {
    onResetReady?.(resetForm)
  }, [onResetReady, resetForm])

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onCancel()
    },
    [onCancel],
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <Flex direction="column" gap="3">
        <form.Field name="date">
          {(field) => {
            const errorMessage = getErrorMessage(field.state.meta.errors[0])
            return (
              <PaymentDateField
                value={field.state.value}
                onChange={(date) => field.handleChange(date)}
                error={!!errorMessage}
                messages={errorMessage ? [errorMessage] : undefined}
              />
            )
          }}
        </form.Field>
        <form.Field name="category">
          {(field) => {
            const errorMessage = getErrorMessage(field.state.meta.errors[0])
            return (
              <CategoryField
                value={field.state.value}
                onChange={(category) => field.handleChange(category)}
                error={!!errorMessage}
                messages={errorMessage ? [errorMessage] : undefined}
              />
            )
          }}
        </form.Field>
        <form.Field name="note">
          {(field) => {
            const errorMessage = getErrorMessage(field.state.meta.errors[0])
            return (
              <NoteField
                value={field.state.value}
                onChange={(note) => field.handleChange(note)}
                error={!!errorMessage}
                messages={errorMessage ? [errorMessage] : undefined}
              />
            )
          }}
        </form.Field>
        <form.Field name="amount">
          {(field) => {
            const errorMessage = getErrorMessage(field.state.meta.errors[0])
            return (
              <AmountField
                value={field.state.value}
                onChange={(amount) => field.handleChange(amount)}
                error={!!errorMessage}
                messages={errorMessage ? [errorMessage] : undefined}
              />
            )
          }}
        </form.Field>
      </Flex>
      <Flex gap="3" mt="4" justify="end">
        <CancelButton onClick={handleCancel} />
        <SubmitButton>Create</SubmitButton>
      </Flex>
    </form>
  )
}

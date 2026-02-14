import { Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useEffect } from "react"
import type { z } from "zod"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountField } from "../AmountField/AmountField"
import { CategoryField } from "../CategoryField"
import { formShema } from "../formSchema"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { useCreatePayment } from "../useCreatePayment"

interface CreatePaymentFormProps {
  onSuccess?: () => void
  onError?: (error?: Error) => void
  onCancel: () => void
  onResetReady?: (resetFn: () => void) => void
}

// Zod validator for TanStack Form
function zodValidator<T>(schema: z.ZodType<T>) {
  return (value: unknown): string | undefined => {
    const result = schema.safeParse(value)
    if (result.success) {
      return undefined
    }
    return result.error.issues[0]?.message ?? "Validation failed"
  }
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
  onResetReady,
}: CreatePaymentFormProps) {
  const { createPayment } = useCreatePayment(onSuccess, onError)

  const form = useForm({
    defaultValues: {
      date: new Date(),
      category: "",
      note: "",
      amount: undefined as unknown as number,
    },
    onSubmit: async ({ value }) => {
      await createPayment({
        categoryId: value.category,
        date: value.date,
        note: value.note,
        amount: value.amount,
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
        <form.Field
          name="date"
          validators={{
            onChange: zodValidator(formShema.shape.date),
          }}
        >
          {(field) => {
            const errorMessage = field.state.meta.errors[0]
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
        <form.Field
          name="category"
          validators={{
            onChange: zodValidator(formShema.shape.category),
          }}
        >
          {(field) => {
            const errorMessage = field.state.meta.errors[0]
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
        <form.Field
          name="note"
          validators={{
            onChange: zodValidator(formShema.shape.note),
          }}
        >
          {(field) => {
            const errorMessage = field.state.meta.errors[0]
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
        <form.Field
          name="amount"
          validators={{
            onChange: zodValidator(formShema.shape.amount),
          }}
        >
          {(field) => {
            const errorMessage = field.state.meta.errors[0]
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

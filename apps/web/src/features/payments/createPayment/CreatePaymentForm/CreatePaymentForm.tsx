import { Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useEffect } from "react"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountField } from "../AmountField/AmountField"
import { CategoryField } from "../CategoryField"
import { ContinueCreatingCheckbox } from "../ContinueCreatingCheckbox"
import { type FormSchema, submitFormSchema } from "../formSchema"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { useCreatePayment } from "../useCreatePayment"

interface CreatePaymentFormProps {
  onSuccess?: () => void
  onError?: (error?: Error) => void
  onCancel: () => void
  onResetReady?: (resetFn: () => void) => void
  continuousMode?: boolean
  onContinuousModeChange?: (checked: boolean) => void
}

function getErrorMessages(errors: unknown): string[] | undefined {
  if (!Array.isArray(errors)) {
    return undefined
  }

  const messages = errors.flatMap((error) => {
    if (typeof error === "string") {
      return [error]
    }

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return [error.message]
    }

    return []
  })

  return messages.length > 0 ? messages : undefined
}

function hasErrorMessages(messages: string[] | undefined): boolean {
  return Boolean(messages && messages.length > 0)
}

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
  onResetReady,
  continuousMode,
  onContinuousModeChange,
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
      onSubmit: submitFormSchema,
    },
    onSubmit: async ({ value }) => {
      const parsedValue = submitFormSchema.parse(value)

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
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <PaymentDateField
                value={field.state.value}
                onChange={(date) => field.handleChange(date)}
                error={hasErrorMessages(errorMessages)}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
        <form.Field name="category">
          {(field) => {
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <CategoryField
                value={field.state.value}
                onChange={(category) => field.handleChange(category)}
                error={hasErrorMessages(errorMessages)}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
        <form.Field name="note">
          {(field) => {
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <NoteField
                value={field.state.value}
                onChange={(note) => field.handleChange(note)}
                error={hasErrorMessages(errorMessages)}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
        <form.Field name="amount">
          {(field) => {
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <AmountField
                value={field.state.value}
                onChange={(amount) => field.handleChange(amount)}
                error={hasErrorMessages(errorMessages)}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
      </Flex>
      <Flex
        mt="4"
        gap="3"
        align="center"
        justify={onContinuousModeChange ? "between" : "end"}
      >
        {onContinuousModeChange ? (
          <ContinueCreatingCheckbox
            checked={continuousMode ?? false}
            onCheckedChange={onContinuousModeChange}
          />
        ) : null}
        <Flex gap="3">
          <CancelButton onClick={handleCancel} />
          <SubmitButton>Create</SubmitButton>
        </Flex>
      </Flex>
    </form>
  )
}

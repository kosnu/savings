import { Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useEffect } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { paymentFormSubmitSchema } from "../../paymentFormSchema"
import { AmountField } from "../AmountField/AmountField"
import { CategoryField } from "../CategoryField"
import { ContinueCreatingCheckbox } from "../ContinueCreatingCheckbox"
import {
  createPaymentDefaultValues,
  mapSubmitFormValuesToPaymentWriteInput,
} from "../createPaymentFormAdapters"
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

export function CreatePaymentForm({
  onSuccess,
  onError,
  onCancel,
  onResetReady,
  continuousMode,
  onContinuousModeChange,
}: CreatePaymentFormProps) {
  const { createPayment } = useCreatePayment(onSuccess, onError)
  const defaultValues = createPaymentDefaultValues()

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: paymentFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const parsedValue = paymentFormSubmitSchema.parse(value)
      try {
        await createPayment(mapSubmitFormValuesToPaymentWriteInput(parsedValue))
      } catch {
        // 作成失敗時の通知は useCreatePayment の onError に委ねる。
      }
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
        void form.handleSubmit()
      }}
    >
      <Flex direction="column" gap="3">
        <form.Field name="date">
          {(field) => {
            const isValid = field.state.meta.isValid
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <PaymentDateField
                value={field.state.value}
                onChange={(date) => field.handleChange(date)}
                error={!isValid}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
        <form.Field name="amount">
          {(field) => {
            const isValid = field.state.meta.isValid
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <AmountField
                value={field.state.value}
                onChange={(amount) => field.handleChange(amount)}
                error={!isValid}
                messages={errorMessages}
                autoFocus
              />
            )
          }}
        </form.Field>
        <form.Field name="category">
          {(field) => {
            const isValid = field.state.meta.isValid
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <CategoryField
                value={field.state.value}
                onChange={(category) => field.handleChange(category)}
                error={!isValid}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
        <form.Field name="note">
          {(field) => {
            const isValid = field.state.meta.isValid
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <NoteField
                value={field.state.value}
                onChange={(note) => field.handleChange(note)}
                error={!isValid}
                messages={errorMessages}
              />
            )
          }}
        </form.Field>
      </Flex>
      <Flex mt="4" gap="3" align="center" justify={onContinuousModeChange ? "between" : "end"}>
        {onContinuousModeChange ? (
          <ContinueCreatingCheckbox
            checked={continuousMode ?? false}
            onCheckedChange={onContinuousModeChange}
          />
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3">
              <CancelButton disabled={isSubmitting} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting}>Create</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

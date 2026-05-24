import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { toAmountFormValue } from "../../../../domain/amount"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { toCategoryCreateErrorMessage } from "../categoryCreateError"
import { categoryCreateSchema, type CategoryCreateFormValues } from "../categoryCreateSchema"
import { useCreateCategory } from "../useCreateCategory"

const defaultValues: CategoryCreateFormValues = {
  name: "",
  budgetAmount: undefined,
}

interface CreateCategoryFormProps {
  onSuccess?: () => void
  onCancel: () => void
}

export function CreateCategoryForm({ onSuccess, onCancel }: CreateCategoryFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const budgetAmountInputId = useId()
  const budgetAmountErrorId = useId()
  const { createCategory, isPending } = useCreateCategory()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: categoryCreateSchema,
    },
    onSubmit: async ({ value }) => {
      if (isPending) return

      const parsedValue = categoryCreateSchema.parse(value)

      try {
        setSubmitErrorMessage(undefined)
        await createCategory(parsedValue)
        form.reset()
        onSuccess?.()
      } catch (error) {
        setSubmitErrorMessage(toCategoryCreateErrorMessage(error))
      }
    },
  })

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (isPending) return

      onCancel()
    },
    [isPending, onCancel],
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setSubmitErrorMessage(undefined)
        void form.handleSubmit()
      }}
    >
      <Flex direction="column" gap="4">
        {submitErrorMessage ? (
          <Callout.Root aria-live="polite" role="alert" color="red" variant="surface" size="1">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{submitErrorMessage}</Callout.Text>
          </Callout.Root>
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex direction="column" gap="3">
              <form.Field name="name">
                {(field) => {
                  const errorMessages = getErrorMessages(field.state.meta.errors) ?? []
                  const hasError = !field.state.meta.isValid && errorMessages.length > 0

                  return (
                    <BaseField>
                      <FieldLabel htmlFor={nameInputId} required>
                        Name
                      </FieldLabel>
                      <TextField.Root
                        autoFocus
                        disabled={isSubmitting || isPending}
                        id={nameInputId}
                        name="name"
                        value={field.state.value}
                        aria-describedby={hasError ? nameErrorId : undefined}
                        aria-invalid={hasError}
                        onChange={(event) => {
                          field.handleChange(event.target.value)
                          setSubmitErrorMessage(undefined)
                        }}
                      />
                      <span id={nameErrorId}>
                        <FieldMessages error={hasError} messages={errorMessages} />
                      </span>
                    </BaseField>
                  )
                }}
              </form.Field>
              <form.Field name="budgetAmount">
                {(field) => {
                  const errorMessages = getErrorMessages(field.state.meta.errors) ?? []
                  const hasError = !field.state.meta.isValid && errorMessages.length > 0

                  return (
                    <BaseField>
                      <FieldLabel htmlFor={budgetAmountInputId}>Monthly budget</FieldLabel>
                      <AmountInput
                        disabled={isSubmitting || isPending}
                        id={budgetAmountInputId}
                        value={toAmountFormValue(field.state.value)}
                        aria-describedby={hasError ? budgetAmountErrorId : undefined}
                        aria-invalid={hasError}
                        onChange={(amount) => {
                          field.handleChange(amount)
                          setSubmitErrorMessage(undefined)
                        }}
                      />
                      <span id={budgetAmountErrorId}>
                        <FieldMessages error={hasError} messages={errorMessages} />
                      </span>
                    </BaseField>
                  )
                }}
              </form.Field>
            </Flex>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3" justify="end">
              <CancelButton disabled={isSubmitting || isPending} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting || isPending}>Create</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

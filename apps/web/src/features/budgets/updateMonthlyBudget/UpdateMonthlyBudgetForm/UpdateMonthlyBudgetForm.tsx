import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, Text } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"
import * as z from "zod"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { amountFieldSchema, toAmountFormValue } from "../../../../domain/amount"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import type { MonthlyBudget } from "../../types"
import { useUpdateMonthlyBudget } from "../useUpdateMonthlyBudget"

const UPDATE_MONTHLY_BUDGET_ERROR_MESSAGE = "Failed to update monthly budget."

const updateMonthlyBudgetFormSubmitSchema = z.object({
  amount: amountFieldSchema,
})

interface UpdateMonthlyBudgetFormValues {
  amount: string | number | undefined
}

interface UpdateMonthlyBudgetFormProps {
  monthlyBudget: MonthlyBudget
  onSuccess?: () => void
  onCancel: () => void
}

export function UpdateMonthlyBudgetForm({
  monthlyBudget,
  onSuccess,
  onCancel,
}: UpdateMonthlyBudgetFormProps) {
  const amountInputId = useId()
  const { updateMonthlyBudget, isPending } = useUpdateMonthlyBudget()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()
  const defaultValues: UpdateMonthlyBudgetFormValues = {
    amount: String(monthlyBudget.amount),
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: updateMonthlyBudgetFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      if (isPending) return

      const parsedValue = updateMonthlyBudgetFormSubmitSchema.parse(value)

      try {
        setSubmitErrorMessage(undefined)
        await updateMonthlyBudget(parsedValue.amount)
        onSuccess?.()
      } catch {
        setSubmitErrorMessage(UPDATE_MONTHLY_BUDGET_ERROR_MESSAGE)
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
        <Flex direction="column" gap="3">
          <BaseField>
            <FieldLabel>Month</FieldLabel>
            <Text>This month</Text>
          </BaseField>
          <form.Field name="amount">
            {(field) => {
              const isValid = field.state.meta.isValid
              const errorMessages = getErrorMessages(field.state.meta.errors)

              return (
                <BaseField>
                  <FieldLabel htmlFor={amountInputId} required>
                    Amount
                  </FieldLabel>
                  <AmountInput
                    id={amountInputId}
                    value={toAmountFormValue(field.state.value)}
                    onChange={(amount) => {
                      field.handleChange(amount)
                      setSubmitErrorMessage(undefined)
                    }}
                    autoFocus
                    disabled={isPending}
                  />
                  <FieldMessages error={!isValid} messages={errorMessages} />
                </BaseField>
              )
            }}
          </form.Field>
        </Flex>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3" justify="end">
              <CancelButton disabled={isSubmitting} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting}>Save</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useState } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { AmountField } from "../AmountField"
import { MonthField } from "../MonthField"
import { toMonthlyBudgetCreateErrorMessage } from "../monthlyBudgetCreateError"
import {
  createMonthlyBudgetDefaultValues,
  mapSubmitFormValuesToMonthlyBudgetWriteInput,
} from "../monthlyBudgetFormAdapters"
import { monthlyBudgetFormSubmitSchema } from "../monthlyBudgetFormSchema"
import { useCreateMonthlyBudget } from "../useCreateMonthlyBudget"

interface CreateMonthlyBudgetFormProps {
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onCancel: () => void
}

export function CreateMonthlyBudgetForm({
  onSuccess,
  onError,
  onCancel,
}: CreateMonthlyBudgetFormProps) {
  const { createMonthlyBudget } = useCreateMonthlyBudget()
  const defaultValues = createMonthlyBudgetDefaultValues()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: monthlyBudgetFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const parsedValue = monthlyBudgetFormSubmitSchema.parse(value)
        await createMonthlyBudget(mapSubmitFormValuesToMonthlyBudgetWriteInput(parsedValue))
        onSuccess?.()
      } catch (error) {
        setSubmitErrorMessage(toMonthlyBudgetCreateErrorMessage(error))
        onError?.(error)
      }
    },
  })

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onCancel()
    },
    [onCancel],
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
          <form.Field name="targetMonth">
            {(field) => {
              const isValid = field.state.meta.isValid
              const errorMessages = getErrorMessages(field.state.meta.errors)
              return (
                <MonthField
                  value={field.state.value}
                  onChange={(targetMonth) => field.handleChange(targetMonth)}
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
                />
              )
            }}
          </form.Field>
        </Flex>
        <Flex gap="3" justify="end">
          <CancelButton onClick={handleCancel} />
          <SubmitButton>Create</SubmitButton>
        </Flex>
      </Flex>
    </form>
  )
}

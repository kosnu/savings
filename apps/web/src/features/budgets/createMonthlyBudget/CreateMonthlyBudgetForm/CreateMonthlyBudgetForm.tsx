import { Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountField } from "../AmountField"
import { MonthField } from "../MonthField"
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

export function CreateMonthlyBudgetForm({
  onSuccess,
  onError,
  onCancel,
}: CreateMonthlyBudgetFormProps) {
  const { createMonthlyBudget } = useCreateMonthlyBudget()
  const defaultValues = createMonthlyBudgetDefaultValues()

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
        form.handleSubmit()
      }}
    >
      <Flex direction="column" gap="3">
        <form.Field name="targetMonth">
          {(field) => {
            const errorMessages = getErrorMessages(field.state.meta.errors)
            return (
              <MonthField
                value={field.state.value}
                onChange={(targetMonth) => field.handleChange(targetMonth)}
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
      <Flex mt="4" gap="3" justify="end">
        <CancelButton onClick={handleCancel} />
        <SubmitButton>Create</SubmitButton>
      </Flex>
    </form>
  )
}

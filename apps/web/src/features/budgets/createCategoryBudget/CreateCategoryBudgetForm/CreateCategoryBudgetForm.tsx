import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useState } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { MonthField } from "../../createMonthlyBudget/MonthField/MonthField"
import { AmountField } from "../AmountField"
import { toCategoryBudgetCreateErrorMessage } from "../categoryBudgetCreateError"
import {
  createCategoryBudgetDefaultValues,
  mapSubmitFormValuesToCategoryBudgetWriteInput,
} from "../categoryBudgetFormAdapters"
import { categoryBudgetFormSubmitSchema } from "../categoryBudgetFormSchema"
import { CategoryField } from "../CategoryField"
import { useCreateCategoryBudget } from "../useCreateCategoryBudget"

interface CreateCategoryBudgetFormProps {
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

export function CreateCategoryBudgetForm({
  onSuccess,
  onError,
  onCancel,
}: CreateCategoryBudgetFormProps) {
  const { createCategoryBudget } = useCreateCategoryBudget()
  const defaultValues = createCategoryBudgetDefaultValues()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: categoryBudgetFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const parsedValue = categoryBudgetFormSubmitSchema.parse(value)
        await createCategoryBudget(mapSubmitFormValuesToCategoryBudgetWriteInput(parsedValue))
        onSuccess?.()
      } catch (error) {
        setSubmitErrorMessage(toCategoryBudgetCreateErrorMessage(error))
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
          <form.Field name="categoryId">
            {(field) => {
              const errorMessages = getErrorMessages(field.state.meta.errors)
              return (
                <CategoryField
                  value={field.state.value}
                  onChange={(categoryId) => field.handleChange(categoryId)}
                  error={hasErrorMessages(errorMessages)}
                  messages={errorMessages}
                />
              )
            }}
          </form.Field>
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
        <Flex gap="3" justify="end">
          <CancelButton onClick={handleCancel} />
          <SubmitButton>Create</SubmitButton>
        </Flex>
      </Flex>
    </form>
  )
}

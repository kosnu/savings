import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useState } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { AmountField } from "../AmountField"
import { toCategoryBudgetCreateErrorMessage } from "../categoryBudgetCreateError"
import {
  createCategoryBudgetDefaultValues,
  mapSubmitFormValuesToCategoryBudgetWriteInput,
} from "../categoryBudgetFormAdapters"
import { categoryBudgetFormSubmitSchema } from "../categoryBudgetFormSchema"
import { CategoryField } from "../CategoryField"
import { MonthField } from "../MonthField"
import { useCreateCategoryBudget } from "../useCreateCategoryBudget"

interface CreateCategoryBudgetFormProps {
  onSuccess?: () => void
  onError?: (error: unknown) => void
  onCancel: () => void
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
              const isValid = field.state.meta.isValid
              const errorMessages = getErrorMessages(field.state.meta.errors)
              return (
                <CategoryField
                  value={field.state.value}
                  onChange={(categoryId) => field.handleChange(categoryId)}
                  error={!isValid}
                  messages={errorMessages}
                />
              )
            }}
          </form.Field>
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

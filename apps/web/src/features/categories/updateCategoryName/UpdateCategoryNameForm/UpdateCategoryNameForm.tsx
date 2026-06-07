import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Checkbox, Flex, Text, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"
import * as z from "zod"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import {
  categoryBudgetInputSchema,
  toCategoryBudgetInput,
  type CategoryBudget,
  type CategoryBudgetUpdateStatus,
} from "../../categoryBudget"
import { CATEGORY_PIN_LIMIT, categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import { categoryNameSchema } from "../../categorySchema"
import { toCategoryNameUpdateErrorMessage } from "../categoryNameUpdateError"
import { useUpdateCategoryName } from "../useUpdateCategoryName"

const updateCategoryNameFormSubmitSchema = z.object({
  name: categoryNameSchema,
  pinned: z.boolean(),
  budgetAmount: categoryBudgetInputSchema,
})

interface UpdateCategoryNameFormValues {
  name: string
  pinned: boolean
  budgetAmount: string
}

interface UpdateCategoryNameFormProps {
  category: {
    id: number
    name: string
    pinned: boolean
    budget: CategoryBudget
  }
  currentPinnedCount?: number
  onSuccess?: () => void
  onCancel: () => void
}

export function UpdateCategoryNameForm({
  category,
  currentPinnedCount = 0,
  onSuccess,
  onCancel,
}: UpdateCategoryNameFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const budgetInputId = useId()
  const budgetErrorId = useId()
  const pinnedInputId = useId()
  const { updateCategoryName, isPending } = useUpdateCategoryName()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()
  const [budgetRemoved, setBudgetRemoved] = useState(false)
  const defaultValues: UpdateCategoryNameFormValues = {
    name: category.name,
    pinned: category.pinned,
    budgetAmount: toCategoryBudgetInput(category.budget),
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: updateCategoryNameFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      if (isPending) return

      const parsedValue = updateCategoryNameFormSubmitSchema.parse(value)

      try {
        setSubmitErrorMessage(undefined)
        const nameChanged = parsedValue.name !== category.name
        const pinChanged = parsedValue.pinned !== category.pinned
        const originalBudgetInput = toCategoryBudgetInput(category.budget)
        const budgetStatus = getBudgetUpdateStatus({
          budgetRemoved,
          originalBudgetInput,
          nextBudgetAmount: parsedValue.budgetAmount,
        })
        const budgetChanged = budgetStatus !== "unchanged"
        const pinningNewCategory = !category.pinned && parsedValue.pinned

        if (pinningNewCategory && currentPinnedCount >= CATEGORY_PIN_LIMIT) {
          setSubmitErrorMessage(categoryPinLimitErrorMessage)
          return
        }

        if (nameChanged || pinChanged || budgetChanged) {
          await updateCategoryName({
            budgetAmount: budgetStatus === "amount" ? parsedValue.budgetAmount : null,
            budgetStatus,
            categoryId: category.id,
            name: parsedValue.name,
            pinned: parsedValue.pinned,
          })
        }

        onSuccess?.()
      } catch (error) {
        setSubmitErrorMessage(toCategoryNameUpdateErrorMessage(error))
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
          <form.Field name="name">
            {(field) => {
              const isValid = field.state.meta.isValid
              const errorMessages = getErrorMessages(field.state.meta.errors) ?? []
              const hasError = !isValid && errorMessages.length > 0

              return (
                <BaseField>
                  <FieldLabel htmlFor={nameInputId} required>
                    Name
                  </FieldLabel>
                  <TextField.Root
                    autoFocus
                    disabled={isPending}
                    id={nameInputId}
                    name="name"
                    value={field.state.value}
                    aria-label="Name"
                    aria-describedby={hasError ? nameErrorId : undefined}
                    aria-invalid={hasError}
                    onChange={(event) => {
                      field.handleChange(event.target.value)
                      setSubmitErrorMessage(undefined)
                    }}
                  />
                  <span id={nameErrorId}>
                    <FieldMessages error={!isValid} messages={errorMessages} />
                  </span>
                </BaseField>
              )
            }}
          </form.Field>
          <form.Field name="budgetAmount">
            {(field) => {
              const isValid = field.state.meta.isValid
              const errorMessages = getErrorMessages(field.state.meta.errors) ?? []
              const hasError = !isValid && errorMessages.length > 0

              return (
                <BaseField>
                  <FieldLabel htmlFor={budgetInputId}>Budget</FieldLabel>
                  <TextField.Root
                    disabled={isPending || budgetRemoved}
                    id={budgetInputId}
                    inputMode="numeric"
                    name="budgetAmount"
                    value={field.state.value}
                    aria-label="Budget"
                    aria-describedby={hasError ? budgetErrorId : undefined}
                    aria-invalid={hasError}
                    onChange={(event) => {
                      field.handleChange(event.target.value)
                      setBudgetRemoved(false)
                      setSubmitErrorMessage(undefined)
                    }}
                  />
                  <span id={budgetErrorId}>
                    <FieldMessages error={!isValid} messages={errorMessages} />
                  </span>
                  {category.budget.state === "amount" || budgetRemoved ? (
                    <Flex justify="start">
                      <Button
                        type="button"
                        color="red"
                        disabled={isPending}
                        size="1"
                        variant="ghost"
                        onClick={() => {
                          field.handleChange("")
                          setBudgetRemoved(true)
                          setSubmitErrorMessage(undefined)
                        }}
                      >
                        Remove budget
                      </Button>
                    </Flex>
                  ) : null}
                </BaseField>
              )
            }}
          </form.Field>
          <form.Field name="pinned">
            {(field) => (
              <Text as="label" size="2" htmlFor={pinnedInputId}>
                <Flex gap="2" align="center">
                  <Checkbox
                    id={pinnedInputId}
                    name="pinned"
                    checked={field.state.value}
                    disabled={isPending}
                    onCheckedChange={(nextChecked) => {
                      field.handleChange(nextChecked === true)
                      setSubmitErrorMessage(undefined)
                    }}
                  />
                  Pin category
                </Flex>
              </Text>
            )}
          </form.Field>
        </Flex>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3" justify="end">
              <CancelButton disabled={isSubmitting || isPending} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting || isPending}>Save</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

function getBudgetUpdateStatus({
  budgetRemoved,
  originalBudgetInput,
  nextBudgetAmount,
}: {
  budgetRemoved: boolean
  originalBudgetInput: string
  nextBudgetAmount: number | null
}): CategoryBudgetUpdateStatus {
  if (budgetRemoved) {
    return "none"
  }

  if (nextBudgetAmount !== null && String(nextBudgetAmount) !== originalBudgetInput) {
    return "amount"
  }

  return "unchanged"
}

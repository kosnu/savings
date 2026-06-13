import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Checkbox, Flex, Text, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"
import * as z from "zod"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { optionalAmountFieldSchema } from "../../../../domain/amount"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { CATEGORY_PIN_LIMIT, categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import { categoryNameSchema } from "../../categorySchema"
import { toCategoryNameUpdateErrorMessage } from "../categoryNameUpdateError"
import { useUpdateCategoryName } from "../useUpdateCategoryName"

const updateCategoryNameFormSubmitSchema = z.object({
  name: categoryNameSchema,
  budgetAmount: optionalAmountFieldSchema,
  pinned: z.boolean(),
})

interface UpdateCategoryNameFormValues {
  name: string
  budgetAmount: string | number | undefined
  pinned: boolean
}

interface UpdateCategoryNameFormProps {
  category: {
    id: number
    name: string
    pinned: boolean
    budgetStatus?: "amount" | "none" | "unset"
    budgetAmount?: number | null
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
  const budgetMessagesId = useId()
  const pinnedInputId = useId()
  const { updateCategoryName, isPending } = useUpdateCategoryName()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()
  const defaultValues: UpdateCategoryNameFormValues = {
    name: category.name,
    budgetAmount: category.budgetStatus === "amount" ? String(category.budgetAmount ?? "") : "",
    pinned: category.pinned,
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
        const pinningNewCategory = !category.pinned && parsedValue.pinned
        const budgetAction = resolveBudgetAction({
          initialStatus: category.budgetStatus ?? "unset",
          initialAmount: category.budgetAmount ?? null,
          nextAmount: parsedValue.budgetAmount,
        })

        if (pinningNewCategory && currentPinnedCount >= CATEGORY_PIN_LIMIT) {
          setSubmitErrorMessage(categoryPinLimitErrorMessage)
          return
        }

        if (nameChanged || pinChanged || budgetAction !== "keep") {
          await updateCategoryName({
            categoryId: category.id,
            name: parsedValue.name,
            pinned: parsedValue.pinned,
            budgetAmount: budgetAction === "set" ? (parsedValue.budgetAmount ?? null) : null,
            budgetAction,
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
              const messages = hasError
                ? errorMessages
                : ["Optional monthly budget for this category."]

              return (
                <BaseField>
                  <FieldLabel htmlFor={budgetInputId}>Budget</FieldLabel>
                  <AmountInput
                    disabled={isPending}
                    id={budgetInputId}
                    name="budgetAmount"
                    value={field.state.value === undefined ? "" : String(field.state.value)}
                    aria-label="Budget"
                    aria-describedby={budgetMessagesId}
                    aria-invalid={hasError}
                    onChange={(value) => {
                      field.handleChange(value)
                      setSubmitErrorMessage(undefined)
                    }}
                  />
                  <span id={budgetMessagesId}>
                    <FieldMessages error={hasError} messages={messages} />
                  </span>
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

function resolveBudgetAction({
  initialStatus,
  initialAmount,
  nextAmount,
}: {
  initialStatus: "amount" | "none" | "unset"
  initialAmount: number | null
  nextAmount: number | undefined
}): "keep" | "set" | "unset" {
  if (nextAmount === undefined) {
    return initialStatus === "amount" ? "unset" : "keep"
  }

  if (initialStatus === "amount" && initialAmount === nextAmount) {
    return "keep"
  }

  return "set"
}

import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Checkbox, Flex, Text, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { translateMessage } from "../../../../i18n/translateMessage"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { CATEGORY_PIN_LIMIT, categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import { toCategoryCreateErrorMessage } from "../categoryCreateError"
import { categoryCreateSchema, type CategoryCreateFormValues } from "../categoryCreateSchema"
import { useCreateCategory } from "../useCreateCategory"

const defaultValues: CategoryCreateFormValues = {
  name: "",
  budgetAmount: "",
  pinned: false,
}

interface CreateCategoryFormProps {
  currentPinnedCount?: number
  onSuccess?: () => void
  onCancel: () => void
}

export function CreateCategoryForm({
  currentPinnedCount = 0,
  onSuccess,
  onCancel,
}: CreateCategoryFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const budgetInputId = useId()
  const budgetMessagesId = useId()
  const pinnedInputId = useId()
  const { t } = useTranslation()
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
        if (parsedValue.pinned && currentPinnedCount >= CATEGORY_PIN_LIMIT) {
          setSubmitErrorMessage(categoryPinLimitErrorMessage)
          return
        }

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
            <Callout.Text>{translateMessage(t, submitErrorMessage)}</Callout.Text>
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
                        {t("categories.name")}
                      </FieldLabel>
                      <TextField.Root
                        autoFocus
                        disabled={isSubmitting || isPending}
                        id={nameInputId}
                        name="name"
                        value={field.state.value}
                        aria-label={t("categories.name")}
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
                  const messages = hasError ? errorMessages : [t("categories.budgetHelp")]

                  return (
                    <BaseField>
                      <FieldLabel htmlFor={budgetInputId}>{t("categories.budget")}</FieldLabel>
                      <AmountInput
                        disabled={isSubmitting || isPending}
                        id={budgetInputId}
                        name="budgetAmount"
                        value={field.state.value === undefined ? "" : String(field.state.value)}
                        aria-label={t("categories.budget")}
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
                        disabled={isSubmitting || isPending}
                        onCheckedChange={(nextChecked) => {
                          field.handleChange(nextChecked === true)
                          setSubmitErrorMessage(undefined)
                        }}
                      />
                      {t("categories.pinCategory")}
                    </Flex>
                  </Text>
                )}
              </form.Field>
            </Flex>
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3" justify="end">
              <CancelButton disabled={isSubmitting || isPending} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting || isPending}>{t("common.create")}</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

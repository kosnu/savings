import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { translateMessage } from "../../../../i18n/translateMessage"
import { CATEGORY_PIN_LIMIT, categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import { CategoryFormFields } from "../../components/CategoryFormFields"
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
            <form.Field name="name">
              {(nameField) => (
                <form.Field name="budgetAmount">
                  {(budgetField) => (
                    <form.Field name="pinned">
                      {(pinnedField) => (
                        <CategoryFormFields
                          name={nameField.state.value}
                          nameErrors={nameField.state.meta.errors}
                          budgetAmount={budgetField.state.value}
                          budgetErrors={budgetField.state.meta.errors}
                          pinned={pinnedField.state.value}
                          disabled={isSubmitting || isPending}
                          onNameChange={(name) => {
                            nameField.handleChange(name)
                            setSubmitErrorMessage(undefined)
                          }}
                          onBudgetAmountChange={(budgetAmount) => {
                            budgetField.handleChange(budgetAmount)
                            setSubmitErrorMessage(undefined)
                          }}
                          onPinnedChange={(pinned) => {
                            pinnedField.handleChange(pinned)
                            setSubmitErrorMessage(undefined)
                          }}
                        />
                      )}
                    </form.Field>
                  )}
                </form.Field>
              )}
            </form.Field>
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

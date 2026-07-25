import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import * as z from "zod"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { optionalAmountFieldSchema } from "../../../../domain/amount"
import { translateMessage } from "../../../../i18n/translateMessage"
import { CATEGORY_PIN_LIMIT, categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import { categoryNameSchema } from "../../categorySchema"
import { CategoryFormFields } from "../../components/CategoryFormFields"
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
  const { t } = useTranslation()
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
            <Callout.Text>{translateMessage(t, submitErrorMessage)}</Callout.Text>
          </Callout.Root>
        ) : null}
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
                      disabled={isPending}
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
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex gap="3" justify="end">
              <CancelButton disabled={isSubmitting || isPending} onClick={handleCancel} />
              <SubmitButton loading={isSubmitting || isPending}>{t("common.save")}</SubmitButton>
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

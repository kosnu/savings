import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useCallback, useId, useState } from "react"
import * as z from "zod"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { categoryNameSchema } from "../../categorySchema"
import { toCategoryNameUpdateErrorMessage } from "../categoryNameUpdateError"
import { useUpdateCategoryName } from "../useUpdateCategoryName"

const updateCategoryNameFormSubmitSchema = z.object({
  name: categoryNameSchema,
})

interface UpdateCategoryNameFormValues {
  name: string
}

interface UpdateCategoryNameFormProps {
  category: {
    id: number
    name: string
  }
  onSuccess?: () => void
  onCancel: () => void
}

export function UpdateCategoryNameForm({
  category,
  onSuccess,
  onCancel,
}: UpdateCategoryNameFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const { updateCategoryName, isPending } = useUpdateCategoryName()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()
  const defaultValues: UpdateCategoryNameFormValues = {
    name: category.name,
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
        await updateCategoryName({
          categoryId: category.id,
          name: parsedValue.name,
        })
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
        <Flex gap="3" justify="end">
          <CancelButton disabled={isPending} onClick={handleCancel} />
          <SubmitButton loading={isPending}>Save</SubmitButton>
        </Flex>
      </Flex>
    </form>
  )
}

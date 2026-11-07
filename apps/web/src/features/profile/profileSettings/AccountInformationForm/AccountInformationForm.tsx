import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import * as z from "zod"

import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { displayNameSchema } from "../../../../domain/displayName"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { getErrorMessages } from "../../../../utils/getErrorMessages"

const profileFormSchema = z.object({ name: displayNameSchema })

interface AccountInformationFormProps {
  displayName: string
  isPending: boolean
  onSaveDisplayName: (name: string) => Promise<void>
}

export function AccountInformationForm({
  displayName,
  isPending,
  onSaveDisplayName,
}: AccountInformationFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues: { name: displayName },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      const parsedValue = profileFormSchema.parse(value)
      if (parsedValue.name === displayName) return

      try {
        setSubmitErrorMessage(undefined)
        await onSaveDisplayName(parsedValue.name)
        openSnackbar("success", t("profile.saveSuccess"))
      } catch {
        setSubmitErrorMessage(t("profile.saveError"))
      }
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setSubmitErrorMessage(undefined)
        void form.handleSubmit()
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => {
          const isSaving = isSubmitting || isPending

          return (
            <Flex direction="column" gap="4">
              {submitErrorMessage ? (
                <Callout.Root
                  aria-live="polite"
                  role="alert"
                  color="red"
                  variant="surface"
                  size="1"
                >
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
                        {t("profile.displayName")}
                      </FieldLabel>
                      <TextField.Root
                        disabled={isSaving}
                        id={nameInputId}
                        name="name"
                        value={field.state.value}
                        aria-label={t("profile.displayName")}
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
              <Flex justify="start">
                <SubmitButton loading={isSaving}>{t("common.save")}</SubmitButton>
              </Flex>
            </Flex>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

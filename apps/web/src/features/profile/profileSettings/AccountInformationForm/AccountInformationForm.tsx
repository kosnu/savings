import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, Text, TextField } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import * as z from "zod"

import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { displayNameSchema, type Profile } from "../profileSchema"

const profileFormSchema = z.object({ name: displayNameSchema })

interface AccountInformationFormProps {
  profile: Profile
  loginMethod: "google" | "unavailable"
  isPending: boolean
  onSaveDisplayName: (name: string) => Promise<void>
}

export function AccountInformationForm({
  profile,
  loginMethod,
  isPending,
  onSaveDisplayName,
}: AccountInformationFormProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues: { name: profile.name },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      const parsedValue = profileFormSchema.parse(value)
      if (parsedValue.name === profile.name) return

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
                    {t("profile.displayName")}
                  </FieldLabel>
                  <TextField.Root
                    disabled={isPending}
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
          <ReadOnlyProfileValue label={t("profile.email")} value={profile.email} />
          <ReadOnlyProfileValue
            label={t("profile.loginMethod")}
            value={
              loginMethod === "unavailable"
                ? t("profile.providerUnavailable")
                : t(`profile.providers.${loginMethod}`)
            }
          />
        </Flex>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex justify="start">
              <SubmitButton loading={isSubmitting || isPending}>{t("common.save")}</SubmitButton>
            </Flex>
          )}
        </form.Subscribe>
      </Flex>
    </form>
  )
}

function ReadOnlyProfileValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="1">
      <Text as="p" size="2" weight="bold">
        {label}
      </Text>
      <Text as="p">{value}</Text>
      <Text as="p" size="1" color="gray">
        {t("profile.readOnly")}
      </Text>
    </Flex>
  )
}

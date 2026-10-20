import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, Heading, Text } from "@radix-ui/themes"
import { useForm } from "@tanstack/react-form"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { DatePicker } from "../../../../components/inputs/DatePicker"
import { parseDateOnlyStringToLocalDate, toDateOnlyString } from "../../../../domain/date"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { fetchSelectedBook } from "../../../books"
import { downloadPaymentsCsv } from "../downloadPaymentsCsv"
import { exportPaymentsSchema } from "../exportPaymentsSchema"
import { fetchExportPayments, PaymentExportLimitError } from "../fetchExportPayments"

export function ExportPayments() {
  const { t } = useTranslation()
  const { session } = useSupabaseSession()
  const { openSnackbar } = useSnackbar()
  const id = useId()
  const request = useRef<AbortController | null>(null)
  const [result, setResult] = useState<"empty" | "limit" | "error" | null>(null)
  const authUserId = session?.user.id

  useEffect(() => () => request.current?.abort(), [authUserId])

  const form = useForm({
    defaultValues: { startDate: "", endDate: "" },
    validators: { onSubmit: exportPaymentsSchema },
    onSubmit: async ({ value }) => {
      if (!authUserId) return
      const controller = new AbortController()
      request.current = controller
      setResult(null)
      try {
        const book = await fetchSelectedBook()
        if (controller.signal.aborted) return
        const payments = await fetchExportPayments(book.id, value, controller.signal)
        if (controller.signal.aborted) return
        if (payments.length === 0) {
          setResult("empty")
          return
        }
        downloadPaymentsCsv(payments, value)
        openSnackbar("success", t("exportPayments.success"))
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult(error instanceof PaymentExportLimitError ? "limit" : "error")
        }
      }
    },
  })

  return (
    <Flex direction="column" gap="4">
      <Heading as="h3" size="4" weight="medium">
        {t("exportPayments.title")}
      </Heading>
      <Text as="p" size="3" color="gray">
        {t("exportPayments.description")}
      </Text>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          setResult(null)
          void form.handleSubmit()
        }}
      >
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Flex direction="column" gap="4" align="start">
              {result && result !== "empty" ? (
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
                  <Callout.Text>{t(`exportPayments.${result}`)}</Callout.Text>
                </Callout.Root>
              ) : null}
              <Flex direction={{ initial: "column", sm: "row" }} gap="3" wrap="wrap">
                {(["startDate", "endDate"] as const).map((name) => (
                  <form.Field key={name} name={name}>
                    {(field) => {
                      const messages = (getErrorMessages(field.state.meta.errors) ?? []).map(
                        (message) => t(message),
                      )
                      const hasError = messages.length > 0
                      return (
                        <BaseField width="fit-content">
                          <FieldLabel htmlFor={`${id}-${name}`} required>
                            {t(`exportPayments.${name}`)}
                          </FieldLabel>
                          <DatePicker
                            id={`${id}-${name}`}
                            name={name}
                            required
                            value={
                              field.state.value
                                ? parseDateOnlyStringToLocalDate(field.state.value)
                                : undefined
                            }
                            disabled={isSubmitting || !authUserId}
                            aria-invalid={hasError}
                            aria-describedby={hasError ? `${id}-${name}-error` : undefined}
                            onBlur={field.handleBlur}
                            onChange={(date) => {
                              field.handleChange(date ? toDateOnlyString(date) : "")
                              setResult(null)
                            }}
                          />
                          <span id={`${id}-${name}-error`}>
                            <FieldMessages error={hasError} messages={messages} />
                          </span>
                        </BaseField>
                      )
                    }}
                  </form.Field>
                ))}
              </Flex>
              <Flex direction="column" gap="2" align="start">
                <Text id={`${id}-limit`} as="p" size="2" color="gray">
                  {t("exportPayments.limitNote")}
                </Text>
                <SubmitButton
                  loading={isSubmitting}
                  disabled={!authUserId}
                  aria-label={t("exportPayments.download")}
                  aria-describedby={`${id}-limit`}
                >
                  {t("exportPayments.download")}
                </SubmitButton>
              </Flex>
              {result === "empty" ? (
                <Text asChild size="2" color="gray">
                  <output>{t("exportPayments.empty")}</output>
                </Text>
              ) : null}
            </Flex>
          )}
        </form.Subscribe>
      </form>
    </Flex>
  )
}

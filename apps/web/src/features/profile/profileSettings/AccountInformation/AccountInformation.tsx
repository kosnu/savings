import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import {
  Button,
  Callout,
  Flex,
  Heading,
  Skeleton,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes"
import type { Session } from "@supabase/supabase-js"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, use, useEffect, useId, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"
import * as z from "zod"

import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { getErrorMessages } from "../../../../utils/getErrorMessages"
import { profileQueryKeys } from "../profileQueryKeys"
import { displayNameSchema, type Profile } from "../profileSchema"
import { useProfile } from "../useProfile"
import { useUpdateDisplayName } from "../useUpdateDisplayName"

const profileFormSchema = z.object({ name: displayNameSchema })

export function AccountInformation() {
  const { session } = useSupabaseSession()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const authUserId = session?.user.id
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [focusHeadingRequest, setFocusHeadingRequest] = useState(0)

  useEffect(() => {
    if (focusHeadingRequest === 0) return

    headingRef.current?.focus({ preventScroll: true })
  }, [focusHeadingRequest])

  return (
    <Flex direction="column" gap="3">
      <Heading ref={headingRef} as="h2" size="4" tabIndex={-1}>
        {t("profile.accountInformation")}
      </Heading>
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <ProfileLoadError
            onRetry={async () => {
              if (!authUserId) {
                resetErrorBoundary()
                return
              }

              await queryClient.refetchQueries(
                {
                  queryKey: profileQueryKeys.current(authUserId),
                  type: "all",
                },
                { throwOnError: true },
              )
              resetErrorBoundary()
              setFocusHeadingRequest((request) => request + 1)
            }}
          />
        )}
        resetKeys={[authUserId]}
      >
        {authUserId && session ? (
          <Suspense fallback={<ProfileLoading />}>
            <AccountInformationContent authUserId={authUserId} session={session} />
          </Suspense>
        ) : (
          <ProfileLoadError onRetry={() => undefined} />
        )}
      </ErrorBoundary>
    </Flex>
  )
}

function AccountInformationContent({
  authUserId,
  session,
}: {
  authUserId: string
  session: Session
}) {
  const { promise } = useProfile(authUserId)
  const profile = use(promise)
  const loginMethod = getLoginMethod(session)

  return (
    <AccountInformationForm
      key={profile.name}
      authUserId={authUserId}
      loginMethod={loginMethod}
      profile={profile}
    />
  )
}

function AccountInformationForm({
  authUserId,
  loginMethod,
  profile,
}: {
  authUserId: string
  loginMethod: LoginMethod
  profile: Profile
}) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const { updateDisplayName, isPending } = useUpdateDisplayName(authUserId)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>()

  const form = useForm({
    defaultValues: { name: profile.name },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      const parsedValue = profileFormSchema.parse(value)
      if (parsedValue.name === profile.name) return

      try {
        setSubmitErrorMessage(undefined)
        await updateDisplayName(parsedValue.name)
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

function ProfileLoading() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("common.loading")} direction="column" gap="3">
      <Skeleton loading>
        <Text>{t("profile.displayName")}</Text>
      </Skeleton>
      <Skeleton loading>
        <Text>{t("profile.email")}</Text>
      </Skeleton>
      <Skeleton loading>
        <Text>{t("profile.loginMethod")}</Text>
      </Skeleton>
      <Skeleton loading>
        <Text>{t("common.save")}</Text>
      </Skeleton>
    </Flex>
  )
}

function ProfileLoadError({ onRetry }: { onRetry: () => Promise<void> | void }) {
  const { t } = useTranslation()
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      await onRetry()
    } catch {
      retryButtonRef.current?.focus({ preventScroll: true })
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Flex direction="column" gap="3" align="start">
      <Callout.Root role="alert" color="red" variant="surface" size="1">
        <Callout.Icon>
          <ExclamationTriangleIcon />
        </Callout.Icon>
        <Callout.Text>{t("profile.loadError")}</Callout.Text>
      </Callout.Root>
      <Button
        ref={retryButtonRef}
        type="button"
        variant="soft"
        size="2"
        disabled={isRetrying}
        aria-busy={isRetrying}
        onClick={() => void handleRetry()}
      >
        {isRetrying ? <Spinner aria-label={t("common.loadingSpinner")} /> : null}
        {t("profile.retry")}
      </Button>
    </Flex>
  )
}

type LoginMethod = "google" | "unavailable"

function getLoginMethod(session: Session): LoginMethod {
  const metadataProvider = session.user.app_metadata.provider
  const identityProvider = session.user.identities?.[0]?.provider
  const provider = [metadataProvider, identityProvider].find(isNonEmptyString)

  return provider === "google" ? "google" : "unavailable"
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

import { Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import type { Session } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, use, useEffect, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { AccountInformationForm } from "../AccountInformationForm"
import { ProfileLoadError } from "../ProfileLoadError"
import { profileQueryKeys } from "../profileQueryKeys"
import { useProfile } from "../useProfile"
import { useUpdateDisplayName } from "../useUpdateDisplayName"

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
  const { updateDisplayName, isPending } = useUpdateDisplayName(authUserId)

  return (
    <AccountInformationForm
      key={profile.name}
      isPending={isPending}
      loginMethod={loginMethod}
      profile={profile}
      onSaveDisplayName={updateDisplayName}
    />
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

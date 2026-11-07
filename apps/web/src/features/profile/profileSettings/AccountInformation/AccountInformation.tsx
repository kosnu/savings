import { Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, useEffect, useRef, useState } from "react"
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
        {t("navigation.account")}
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
        {authUserId ? (
          <Suspense key={authUserId} fallback={<ProfileLoading />}>
            <AccountInformationContent authUserId={authUserId} />
          </Suspense>
        ) : (
          <ProfileLoadError onRetry={() => undefined} />
        )}
      </ErrorBoundary>
    </Flex>
  )
}

function AccountInformationContent({ authUserId }: { authUserId: string }) {
  const { t } = useTranslation()
  const { data: profile } = useProfile(authUserId)
  const { updateDisplayName, isPending } = useUpdateDisplayName(authUserId)

  return (
    <Flex direction="column" gap="4">
      <AccountInformationForm
        key={profile.name}
        displayName={profile.name}
        isPending={isPending}
        onSaveDisplayName={updateDisplayName}
      />
      <Flex direction="column" gap="1">
        <Text as="p" size="2" weight="bold">
          {t("profile.email")}
        </Text>
        <Text as="p" style={{ overflowWrap: "anywhere" }}>
          {profile.email}
        </Text>
        <Text as="p" size="1" color="gray">
          {t("profile.readOnly")}
        </Text>
      </Flex>
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
        <Text>{t("common.save")}</Text>
      </Skeleton>
      <Skeleton loading>
        <Text>{t("profile.email")}</Text>
      </Skeleton>
    </Flex>
  )
}

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

type Section = "profile" | "account"

export function AccountInformation({ section }: { section: Section }) {
  const { session } = useSupabaseSession()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const authUserId = session?.user.id
  const isProfile = section === "profile"
  const loadErrorKey = isProfile ? "profile.loadError" : "account.emailLoadError"
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [focusHeadingRequest, setFocusHeadingRequest] = useState(0)

  useEffect(() => {
    if (focusHeadingRequest === 0) return

    headingRef.current?.focus({ preventScroll: true })
  }, [focusHeadingRequest])

  return (
    <Flex direction="column" gap="3">
      <Heading ref={headingRef} as="h2" size="4" tabIndex={-1}>
        {t(isProfile ? "navigation.profile" : "navigation.account")}
      </Heading>
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <ProfileLoadError
            messageKey={loadErrorKey}
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
        resetKeys={[authUserId, section]}
      >
        {authUserId ? (
          <Suspense key={authUserId} fallback={<ProfileLoading section={section} />}>
            {isProfile ? (
              <DisplayNameContent authUserId={authUserId} />
            ) : (
              <AccountEmail authUserId={authUserId} />
            )}
          </Suspense>
        ) : (
          <ProfileLoadError messageKey={loadErrorKey} onRetry={() => undefined} />
        )}
      </ErrorBoundary>
    </Flex>
  )
}

function DisplayNameContent({ authUserId }: { authUserId: string }) {
  const { data: profile } = useProfile(authUserId)
  const { updateDisplayName, isPending } = useUpdateDisplayName(authUserId)

  return (
    <AccountInformationForm
      key={profile.name}
      displayName={profile.name}
      isPending={isPending}
      onSaveDisplayName={updateDisplayName}
    />
  )
}

function AccountEmail({ authUserId }: { authUserId: string }) {
  const { t } = useTranslation()
  const { data: profile } = useProfile(authUserId)

  return (
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
  )
}

function ProfileLoading({ section }: { section: Section }) {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("common.loading")} direction="column" gap="3">
      <Skeleton loading>
        <Text>{t(section === "profile" ? "profile.displayName" : "profile.email")}</Text>
      </Skeleton>
      {section === "profile" && (
        <Skeleton loading>
          <Text>{t("common.save")}</Text>
        </Skeleton>
      )}
    </Flex>
  )
}

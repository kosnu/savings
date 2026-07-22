import { Badge, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import type { CurrentBook } from "../fetchCurrentBook"
import { useCurrentBook } from "../useCurrentBook"

export function CurrentBookInformation() {
  const { session } = useSupabaseSession()
  const { t } = useTranslation()
  const authUserId = session?.user.id

  return (
    <ErrorBoundary
      fallback={
        <Text color="red" role="alert">
          {t("books.loadError")}
        </Text>
      }
      resetKeys={[authUserId]}
    >
      {authUserId ? (
        <Suspense fallback={<CurrentBookInformationLoading />}>
          <CurrentBookInformationContent authUserId={authUserId} />
        </Suspense>
      ) : (
        <Text color="red" role="alert">
          {t("books.loadError")}
        </Text>
      )}
    </ErrorBoundary>
  )
}

function CurrentBookInformationContent({ authUserId }: { authUserId: string }) {
  const { promise } = useCurrentBook(authUserId)
  const book = use(promise)

  return <CurrentBookDetails book={book} />
}

function CurrentBookDetails({ book }: { book: CurrentBook }) {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="2">
      <Flex align="center" gap="2" wrap="wrap">
        <Heading as="h2" size="5">
          {book.name}
        </Heading>
        <Badge variant="soft">{t("books.current")}</Badge>
      </Flex>
      <Text color="gray">{t("books.settingsDescription")}</Text>
    </Flex>
  )
}

function CurrentBookInformationLoading() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("books.loadingCurrent")} direction="column" gap="2">
      <Skeleton loading>
        <Heading as="h2" size="5">
          {t("books.current")}
        </Heading>
      </Skeleton>
      <Skeleton loading>
        <Text>{t("books.settingsDescription")}</Text>
      </Skeleton>
    </Flex>
  )
}

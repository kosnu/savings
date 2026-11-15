import { PlusIcon } from "@radix-ui/react-icons"
import { Box, Button, Container, Flex, Heading, Text } from "@radix-ui/themes"
import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { selectedBookQueryOptions } from "../../../features/books"
import { CreatePaymentModal, PaymentList, PaymentSearchForm } from "../../../features/payments"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"
import { useInitializeMonthSearch } from "../../useInitializeMonthSearch"

export function PaymentsPage() {
  useInitializeMonthSearch()
  const [paymentsPageCacheScope] = useState(() => `payments-page-${crypto.randomUUID()}`)
  const { session } = useSupabaseSession()

  if (!session) {
    return null
  }

  return (
    <PaymentsPageContent
      authUserId={session.user.id}
      paymentsPageCacheScope={paymentsPageCacheScope}
    />
  )
}

function PaymentsPageContent({
  authUserId,
  paymentsPageCacheScope,
}: {
  authUserId: string
  paymentsPageCacheScope: string
}) {
  const { data: book, isError, refetch } = useQuery(selectedBookQueryOptions(authUserId))
  const { t } = useTranslation()
  const pageRef = useRef<HTMLElement>(null)

  return (
    <Container asChild size="2">
      <section ref={pageRef} tabIndex={-1} aria-label={t("navigation.payments")}>
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Heading as="h1" size="6">
              {t("navigation.payments")}
            </Heading>
            {book && (
              <Box flexShrink="0">
                <CreatePaymentModal
                  bookId={book.id}
                  trigger={
                    <Button variant="solid">
                      <PlusIcon aria-hidden />
                      {t("payments.create.trigger")}
                    </Button>
                  }
                />
              </Box>
            )}
          </Flex>
          <PaymentSearchForm />
          {book ? (
            <PaymentList bookId={book.id} cacheScope={paymentsPageCacheScope} />
          ) : isError ? (
            <Flex direction="column" gap="2" align="start">
              <Text color="red" role="alert">
                {t("books.loadError")}
              </Text>
              <Button
                type="button"
                variant="soft"
                onClick={() => {
                  pageRef.current?.focus({ preventScroll: true })
                  void refetch()
                }}
              >
                {t("common.retry")}
              </Button>
            </Flex>
          ) : (
            <Text asChild color="gray" size="2">
              <output>{t("common.loading")}</output>
            </Text>
          )}
        </Flex>
      </section>
    </Container>
  )
}

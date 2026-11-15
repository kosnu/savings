import { Box, Card, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { type ReactNode, useId } from "react"
import { useTranslation } from "react-i18next"

import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"
import { MonthSelector } from "../MonthSelector"

import styles from "./Summary.module.css"

interface SummaryProps {
  cacheScope?: string
  monthSelectorTo?: "/" | "/payments"
  loading?: boolean
  reserveSpace?: boolean
  chart?: ReactNode
}

export function Summary({
  cacheScope,
  monthSelectorTo,
  loading = false,
  reserveSpace = false,
  chart,
}: SummaryProps) {
  const { t } = useTranslation()
  const headingId = useId()

  return (
    <Flex asChild direction="column" gap="3" width="100%">
      <section aria-labelledby={headingId}>
        <Heading as="h2" size="4" weight="medium" id={headingId}>
          {t("summary.monthlyOverview")}
        </Heading>
        <Flex justify="center">
          <Skeleton loading={loading}>
            <Box inert={loading}>
              <MonthSelector to={monthSelectorTo} />
            </Box>
          </Skeleton>
        </Flex>
        <Card size="2">
          <Flex
            direction="column"
            width="100%"
            className={reserveSpace ? styles.monthly : undefined}
          >
            {loading ? <Skeleton height="var(--line-height-6)" width="100%" /> : <MonthlyTotals />}
          </Flex>
        </Card>
        {chart}
        <Card size="2">
          <Box>
            {loading ? (
              <Flex direction="column" gap="2" aria-hidden>
                {[0, 1, 2].map((row) => (
                  <Flex key={row} direction="column" gap="1">
                    <Skeleton>
                      <Text>Category</Text>
                    </Skeleton>
                    <Skeleton height="var(--space-2)" />
                    <Flex justify="end">
                      <Skeleton>
                        <Text size="1">¥0,000</Text>
                      </Skeleton>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <CategoryTotals cacheScope={cacheScope} />
            )}
          </Box>
        </Card>
      </section>
    </Flex>
  )
}

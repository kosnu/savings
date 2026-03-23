import { ChevronRightIcon } from "@radix-ui/react-icons"
import { Badge, Card, Flex, Skeleton, Text } from "@radix-ui/themes"

interface PaymentCardProps {
  loading?: boolean
  date?: string
  categoryName?: string
  note?: string
  amount?: string
  interactive?: boolean
}

export function PaymentCard({
  loading = false,
  date = "0000/00/00",
  categoryName = "Category name",
  note = "Note",
  amount = "¥0,000,000",
  interactive = false,
}: PaymentCardProps) {
  return (
    <Card aria-label={loading ? "loading-payment-item" : "payment-item"} size="2">
      <Flex direction="column" gap="1">
        <Flex direction="row" justify="between" align="center" gap="2">
          <Flex direction="row" align="center" gap="2">
            <Skeleton loading={loading}>
              <Text size="3" color="gray">
                {date}
              </Text>
              <Badge size="3">{categoryName}</Badge>
            </Skeleton>
          </Flex>
          {interactive ? <ChevronRightIcon width="20" height="20" aria-hidden /> : null}
        </Flex>
        <Skeleton loading={loading}>
          <Text size="5">{note}</Text>
        </Skeleton>
        <Skeleton loading={loading}>
          <Text align="right" size="6" weight="bold">
            {amount}
          </Text>
        </Skeleton>
      </Flex>
    </Card>
  )
}

import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { Badge, Card, Flex, IconButton, Skeleton, Text } from "@radix-ui/themes"

interface PaymentCardProps {
  loading?: boolean
  date?: string
  categoryName?: string
  note?: string
  amount?: string
}

export function PaymentCard({
  loading = false,
  date = "0000/00/00",
  categoryName = "Category name",
  note = "Note",
  amount = "¥0,000,000",
}: PaymentCardProps) {
  return (
    <Card
      aria-label={loading ? "loading-payment-item" : "payment-item"}
      size="2"
    >
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
          <IconButton aria-label="Payment actions" size="3" variant="ghost">
            <DotsVerticalIcon width="18" height="18" />
          </IconButton>
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

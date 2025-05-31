import { Card, Flex, Text } from "@radix-ui/themes"
import { toCurrency } from "../../../utils/toCurrency"

interface MoneyCardProps {
  title: string
  value: number
}

export function MoneyCard({ title, value }: MoneyCardProps) {
  return (
    <Card size="4" style={{ width: "100%" }}>
      <Flex gap="1" direction="column">
        <Text>{title}</Text>
        <Text weight="bold" size="5">
          {toCurrency(value)}
        </Text>
      </Flex>
    </Card>
  )
}

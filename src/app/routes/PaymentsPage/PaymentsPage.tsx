import { Container, Flex } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { CreatePaymentModal } from "../../../features/createPayment"
import { PaymentList } from "../../../features/listPayment"
import { Summary } from "../../../features/summaryByMonth"

export function PaymentsPage() {
  // 再レンダリングをトリガーするための状態
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreateSuccess = useCallback(() => {
    // 状態を更新して再レンダリングをトリガー
    setRefreshKey((prevKey) => prevKey + 1)
  }, [])

  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Summary />
        <Flex justify="end" align="center" gap="3">
          <CreatePaymentModal onSuccess={handleCreateSuccess} />
        </Flex>
        <PaymentList key={refreshKey} />
      </Flex>
    </Container>
  )
}

import { useQuery } from "@tanstack/react-query"
import type { Payment } from "../../../types/payment"
import { useDateRange } from "../../../utils/useDateRange"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  data: Payment[]
  loading: boolean
  promise: Promise<Payment[]>
  error: Error | null
}

export function usePayments(): UseGetPaymentsReturn {
  const { date, dateRange } = useDateRange()
  const query = useQuery({
    queryKey: ["payments", date?.toISOString() ?? "all"],
    queryFn: () => fetchPayments(dateRange),
    enabled: date !== null,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data || [],
    loading: query.isLoading,
    promise: query.promise,
    error: query.error,
  }
}

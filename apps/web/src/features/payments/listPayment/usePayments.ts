import { useQuery } from "@tanstack/react-query"
import { useFirestore } from "../../../providers/firebase/useFirestore"
import type { Payment } from "../../../types/payment"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { useDateRange } from "../../../utils/useDateRange"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  data: Payment[]
  loading: boolean
  promise: Promise<Payment[]>
  error: Error | null
}

export function usePayments(): UseGetPaymentsReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const { date, dateRange } = useDateRange()
  const query = useQuery({
    queryKey: ["payments", date?.toISOString() ?? "all", currentUser?.uid],
    queryFn: () => fetchPayments(db, currentUser, dateRange),
    // データを無期限に新鮮（fresh）扱いにすることで、同じ queryKey で
    // コンポーネントがマウントしても React Query が自動で再フェッチしません。
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data || [],
    loading: query.isLoading,
    promise: query.promise,
    error: query.error,
  }
}

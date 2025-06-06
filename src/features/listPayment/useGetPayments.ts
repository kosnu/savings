import { useCallback } from "react"
import type { Payment } from "../../types/payment"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../utils/firebase/useFirestore"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  getPayments: () => Promise<Payment[]>
}

export function useGetPayments(
  dateRange: [Date | null, Date | null],
): UseGetPaymentsReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getPayments = useCallback(async (): Promise<Payment[]> => {
    return await fetchPayments(db, currentUser, dateRange)
  }, [db, currentUser, dateRange])

  return {
    getPayments: getPayments,
  }
}

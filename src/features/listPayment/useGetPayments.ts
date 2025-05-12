import { useCallback } from "react"
import type { Payment } from "../../types/payment"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../utils/firebase/useFirestore"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  getPayments: () => Promise<Payment[]>
}

export function useGetPayments(): UseGetPaymentsReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getPayments = useCallback(async (): Promise<Payment[]> => {
    return await fetchPayments(db, currentUser)
  }, [db, currentUser])

  return {
    getPayments: getPayments,
  }
}

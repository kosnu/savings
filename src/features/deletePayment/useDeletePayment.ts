import { useCallback } from "react"
import type { Payment } from "../../types/payment"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../utils/firebase/useFirestore"
import { removePayment } from "./removePayment"

interface UseDeletePaymentReturn {
  deletePayment: (payment: Payment) => Promise<void>
}

export function useDeletePayment(): UseDeletePaymentReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const deletePayment = useCallback(
    async (payment: Payment) => {
      if (!currentUser) {
        throw new Error("User is not authenticated.")
      }

      await removePayment(db, currentUser.uid, payment.id)
    },
    [db, currentUser],
  )

  return {
    deletePayment: deletePayment,
  }
}

import { collection, getDocs, query, where } from "firebase/firestore"
import { useCallback } from "react"
import type { Payment } from "../../types/payment"
import { useAuthCurrentUser } from "../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../utils/firebase"

interface UseGetPaymentsReturn {
  getPayments: () => Promise<Payment[]>
}

export function useGetPayments(): UseGetPaymentsReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getPayments = useCallback(async (): Promise<Payment[]> => {
    if (!currentUser) {
      return []
    }

    const paymentsRef = collection(db, `users/${currentUser.uid}/payments`)
    const querySnapshot = await getDocs(
      query(paymentsRef, where("user_id", "==", currentUser.uid)),
    )

    const payments = querySnapshot.docs.map((doc) => {
      const data = doc.data()

      // FIXME: as をやめてconverterを使う
      return {
        id: doc.id,
        title: data.title as string,
        price: data.price as number,
        date: data.date as Date,
        createdDate: data.createdDate as Date,
        updatedDate: data.updatedDate as Date,
      }
    })

    return payments
  }, [db, currentUser])

  return {
    getPayments: getPayments,
  }
}

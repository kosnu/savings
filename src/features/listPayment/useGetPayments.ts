import { getAuth } from "firebase/auth"
import { collection, doc, getDocs, query, where } from "firebase/firestore"
import { useCallback } from "react"
import { useFirestore } from "../../networks/firebase"
import type { Payment } from "../../types/payment"
import { userAuth } from "../../utils/auth/AuthProvider"

interface UseGetPaymentsReturn {
  getPayments: () => Promise<Payment[]>
}

export function useGetPayments(): UseGetPaymentsReturn {
  const auth = getAuth()
  const db = useFirestore()

  const getPayments = useCallback(async () => {
    // FIXME: 要リファクタリング - ページ読み込み時に支払い情報を取得できない
    if (!auth.currentUser) return []

    const userDocRef = doc(db, "users", auth.currentUser.uid)
    const paymentsCollection = collection(db, "payments")
    const result = await getDocs(
      query(paymentsCollection, where("user_id", "==", userDocRef)),
    )

    return result.docs.map((doc) => {
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
  }, [db, auth])

  return {
    getPayments: getPayments,
  }
}

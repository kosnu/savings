import { collection, getDocs } from "firebase/firestore"
import { useFirestore } from "../../networks/firebase"
import type { Payment } from "../../types/payment"

interface UseGetPaymentsReturn {
  getPayments: () => Promise<Payment[]>
}

export function useGetPayments(): UseGetPaymentsReturn {
  const db = useFirestore()

  async function getPayments(): Promise<Payment[]> {
    const paymentsCollection = collection(db, "payments")
    const result = await getDocs(paymentsCollection)

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
  }

  return {
    getPayments: getPayments,
  }
}

import type { User } from "firebase/auth"
import {
  type Firestore,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import type { Payment } from "../../types/payment"

export async function fetchPayments(
  db: Firestore,
  user: User | null,
): Promise<Payment[]> {
  if (!user) {
    return []
  }

  const paymentsRef = collection(db, `users/${user.uid}/payments`)
  const querySnapshot = await getDocs(
    query(
      paymentsRef,
      where("user_id", "==", user.uid),
      orderBy("date", "desc"),
    ),
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
}

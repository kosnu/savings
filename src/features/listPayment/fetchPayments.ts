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
import { collections } from "../../utils/firebase/store"

export async function fetchPayments(
  db: Firestore,
  user: User | null,
  [startDate, endDate]: [Date | null, Date | null],
): Promise<Payment[]> {
  if (!user) {
    return []
  }

  const paymentsRef = collection(
    db,
    collections.payments.path(user.uid),
  ).withConverter(collections.payments.converter)
  const querySnapshot = await getDocs(
    query(
      paymentsRef,
      where("user_id", "==", user.uid),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc"),
    ),
  )

  const payments = querySnapshot.docs.map((doc) => doc.data())

  return payments
}

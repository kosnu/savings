import type { User } from "firebase/auth"
import {
  collection,
  type Firestore,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import { collections } from "../../../providers/firebase/store"
import type { Payment } from "../../../types/payment"

export async function fetchPayments(
  db: Firestore,
  user: User | null,
  [startDate, endDate]: [Date | null, Date | null],
): Promise<Payment[]> {
  if (!user) {
    return []
  }

  const queryConstrations = [where("user_id", "==", user.uid)]
  if (startDate) {
    queryConstrations.push(where("date", ">=", startDate))
  }
  if (endDate) {
    queryConstrations.push(where("date", "<=", endDate))
  }

  const paymentsRef = collection(
    db,
    collections.payments.path(user.uid),
  ).withConverter(collections.payments.converter)
  const querySnapshot = await getDocs(
    query(paymentsRef, ...queryConstrations, orderBy("date", "desc")),
  )

  const payments = querySnapshot.docs.map((doc) => doc.data())

  return payments
}

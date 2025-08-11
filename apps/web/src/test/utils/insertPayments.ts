import type { Auth } from "firebase/auth"
import {
  doc,
  type Firestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { collections } from "../../providers/firebase/store"
import type { Payment } from "../../types/payment"

export async function insertPayments(
  auth: Auth,
  firestore: Firestore,
  payments: Payment[],
) {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error("未認証です")

  for (const payment of payments) {
    const paymentRef = payment.id
      ? doc(firestore, collections.payments.path(userId), payment.id)
      : doc(firestore, collections.payments.path(userId))
    await setDoc(paymentRef.withConverter(collections.payments.converter), {
      ...payment,
      userId: userId,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    })
  }
}

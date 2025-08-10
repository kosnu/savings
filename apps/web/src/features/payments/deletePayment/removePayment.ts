import { deleteDoc, doc, type Firestore } from "firebase/firestore"
import { collections } from "../../../utils/firebase/store"

export async function removePayment(
  db: Firestore,
  userId: string,
  paymentId: string | undefined,
): Promise<void> {
  if (paymentId === undefined) throw new Error("paymentId is undefined.")

  const paymentRef = doc(db, collections.payments.path(userId), paymentId)
  await deleteDoc(paymentRef)
}

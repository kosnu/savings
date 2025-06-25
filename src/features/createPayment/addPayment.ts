import {
  type Firestore,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore"
import type { Payment } from "../../types/payment"
import { collections } from "../../utils/firebase/store"

type PaymentValue = Omit<
  Payment,
  "id" | "userId" | "createdDate" | "updatedDate"
>

interface AddPaymentProps {
  db: Firestore
  userId: string
  value: PaymentValue
}

export async function addPayment({ db, userId, value }: AddPaymentProps) {
  return await addDoc(
    collection(db, collections.payments.path(userId)).withConverter(
      collections.payments.converter,
    ),
    {
      ...value,
      userId: userId,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    },
  )
}

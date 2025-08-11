import {
  addDoc,
  collection,
  type Firestore,
  serverTimestamp,
} from "firebase/firestore"
import { collections } from "../../../providers/firebase/store"
import type { Payment } from "../../../types/payment"

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

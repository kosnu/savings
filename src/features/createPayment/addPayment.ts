import {
  type Firestore,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore"
import { collections } from "../../utils/firebase/store"

interface AddPaymentProps {
  db: Firestore
  userId: string
  value: {
    date: string
    note: string
    amount: number
  }
}

export async function addPayment({ db, userId, value }: AddPaymentProps) {
  const { date, note, amount } = value

  return await addDoc(
    collection(db, collections.payments.path(userId)).withConverter(
      collections.payments.converter,
    ),
    {
      date: new Date(date),
      note: note,
      amount: amount,
      userId: userId,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    },
  )
}

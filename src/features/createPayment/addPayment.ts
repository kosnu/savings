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
    title: string
    price: number
  }
}

export async function addPayment({ db, userId, value }: AddPaymentProps) {
  const { date, title, price } = value

  return await addDoc(
    collection(db, collections.payments.path(userId)).withConverter(
      collections.payments.converter,
    ),
    {
      date: new Date(date),
      title: title,
      price: price,
      userId: userId,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    },
  )
}

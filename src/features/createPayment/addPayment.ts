import {
  type Firestore,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore"

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
  return await addDoc(collection(db, `users/${userId}/payments`), {
    ...value,
    user_id: userId,
    created_date: serverTimestamp(),
    updated_date: serverTimestamp(),
  })
}

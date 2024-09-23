import { type Firestore, addDoc, collection } from "firebase/firestore"

interface AddPaymentProps {
  db: Firestore
  value: {
    date: string
    title: string
    price: number
    createdDate: string
    updatedDate: string
  }
}

export async function addPayment({ db, value }: AddPaymentProps) {
  return await addDoc(collection(db, "payments"), {
    ...value,
    created_date: value.createdDate,
    updated_date: value.updatedDate,
  })
}

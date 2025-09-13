import { parsePrice } from "../../utils/parsePrice.ts"
import { PaymentRecord } from "./types.ts"
import { addDoc } from "../../services/firebase/addDoc.ts"

export async function createPaymentDoc(
  token: string,
  database: string,
  projectId: string,
  userId: string,
  payment: PaymentRecord,
) {
  const paymentData = {
    date: new Date(payment.date.replace(/\//g, "-")), // YYYY-MM-DD 形式に統一
    category_id: payment.categoryId,
    note: payment.note,
    amount: parsePrice(payment.amount),
    user_id: userId,
  }

  await addDoc({
    token,
    database,
    projectId,
    path: `users/${userId}/payments`,
    doc: paymentData,
  })
}

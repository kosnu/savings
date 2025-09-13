import { Doc } from "../../services/firebase/types.ts"

export interface PaymentRecord extends Doc {
  date: string
  categoryId: string
  note: string
  amount: string
}

import { Doc } from "../../services/firebase/types.ts"

export interface PaymentRecord extends Doc {
  date: string
  category: string
  note: string
  amount: string
}

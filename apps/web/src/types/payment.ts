import type { Tables } from "./database.types"

export type PaymentRow = Tables<"payments">

export interface Payment {
  id?: number
  categoryId: number | null
  note: string
  amount: number
  date: Date
  userId: number
  createdDate: Date
  updatedDate: Date
}

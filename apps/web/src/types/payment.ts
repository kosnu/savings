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

export type PaymentId = NonNullable<Payment["id"]>

export interface PaymentCategory {
  id: number
  name: string
}

export interface PaymentDetails extends Omit<Payment, "categoryId"> {
  category: PaymentCategory | null
}

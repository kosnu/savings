export interface Payment {
  id?: string
  categoryId: string
  note: string
  amount: number
  date: Date
  userId: string
  createdDate: Date
  updatedDate: Date
}

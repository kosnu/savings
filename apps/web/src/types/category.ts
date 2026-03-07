import type { Tables } from "./database.types"

export type CategoryRow = Tables<"categories">

export interface Category {
  id: number
  name: string
  createdDate: Date
  updatedDate: Date
}

import type { Category } from "../../types/category"

export const unknownCategory: Category = {
  id: -1,
  bookId: 0,
  name: "Unknown",
  createdDate: new Date(),
  updatedDate: new Date(),
}

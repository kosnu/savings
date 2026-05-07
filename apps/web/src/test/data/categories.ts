import type { Category } from "../../types/category"

export const foodCat: Category = {
  id: 10,
  bookId: 1,
  name: "Food",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const dailyNecessitiesCat: Category = {
  id: 20,
  bookId: 1,
  name: "Daily Necessities",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const entertainmentCat: Category = {
  id: 30,
  bookId: 1,
  name: "Entertainment",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const otherBookFoodCat: Category = {
  id: 40,
  bookId: 2,
  name: "Food",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const categories: Category[] = [foodCat, dailyNecessitiesCat, entertainmentCat]
export const allCategories: Category[] = [...categories, otherBookFoodCat]

import type { Category } from "../../types/category"

export const foodCat: Category = {
  id: 10,
  name: "Food",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const dailyNecessitiesCat: Category = {
  id: 20,
  name: "Daily Necessities",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const entertainmentCat: Category = {
  id: 30,
  name: "Entertainment",
  createdDate: new Date(),
  updatedDate: new Date(),
}

export const categories: Category[] = [foodCat, dailyNecessitiesCat, entertainmentCat]

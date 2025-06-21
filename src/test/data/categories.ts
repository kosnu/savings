import type { Category } from "../../types/category"

export const foodCat = {
  id: "VgtuFszVjxOlwM040cyf",
  name: "Food",
  userId: "your-user-id", // ユーザーIDに置き換えてください
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const dailyNecessitiesCat = {
  id: "eq1duDRDUKJTFZac1Ztp",
  name: "Daily Necessities",
  userId: "your-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const entertainmentCat = {
  id: "Pdgee5Sp6vhRanU3gEv0",
  name: "Entertainment",
  userId: "your-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const categories: Category[] = [
  foodCat,
  dailyNecessitiesCat,
  entertainmentCat,
]

import type { Tables } from "./database.types"

export type UserRow = Tables<"users">

export interface User {
  id: number
  name: string
  email: string
}

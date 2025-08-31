import { Doc } from "../../services/firebase/types.ts"

export interface CategoryRecord extends Doc {
  name: string
}

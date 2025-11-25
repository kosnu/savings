import { Category } from "./entities/category.ts"

export interface CategoryRepository {
  findAll(): Promise<ReadonlyArray<Category>>
}

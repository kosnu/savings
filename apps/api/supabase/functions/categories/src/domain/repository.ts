import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { Category } from "./entities/category.ts"

export interface CategoryRepository {
  findAll(): Promise<Result<ReadonlyArray<Category>, DomainError>>
}

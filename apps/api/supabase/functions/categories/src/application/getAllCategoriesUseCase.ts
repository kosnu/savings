import { CategoryRepository } from "../domain/repository.ts"
import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { CategoryDto, convertCategoryToDto } from "./categoryDto.ts"

export async function getAllCategoriesUseCase(
  categoryRepository: CategoryRepository,
): Promise<Result<ReadonlyArray<CategoryDto>, DomainError>> {
  const result = await categoryRepository.findAll()
  return result.isOk
    ? { isOk: true, value: result.value.map(convertCategoryToDto) }
    : result
}

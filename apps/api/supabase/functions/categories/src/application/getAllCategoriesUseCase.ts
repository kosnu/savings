import { CategoryRepository } from "../domain/repository.ts"
import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { CategoryDto, convertCategoryToDto } from "./categoryDto.ts"

export async function getAllCategoriesUseCase(
  categoryRepository: CategoryRepository,
): Promise<Result<ReadonlyArray<CategoryDto>, DomainError>> {
  const result = await categoryRepository.findAll()
  if (result.isOk) {
    const dtos = result.value.map(convertCategoryToDto)
    return { isOk: true, value: dtos }
  } else {
    return { isOk: false, error: result.error }
  }
}

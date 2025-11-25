import { CategoryRepository } from "../domain/repository.ts"
import { CategoryDto, convertCategoryToDto } from "./categoryDto.ts"

export async function getAllCategoriesUseCase(
  categoryRepository: CategoryRepository,
): Promise<ReadonlyArray<CategoryDto>> {
  const result = await categoryRepository.findAll()
  return result.map(convertCategoryToDto)
}

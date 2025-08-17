import { Select } from "@radix-ui/themes"
import { memo, Suspense, use, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { BaseField } from "../../../../components/inputs/BaseField"
import type { Category } from "../../../../types/category"
import { useCategories } from "../../../categories/listCategory/useCategories"

interface CategoryFieldProps {
  error?: { message: string }
  helperText?: string
}

export const CategoryField = memo(function CategoryField({
  error,
  helperText,
}: CategoryFieldProps) {
  const id = useId()
  const { promiseCategories } = useCategories()

  return (
    <BaseField
      label="Category"
      htmlFor={id}
      required
      error={Boolean(error)}
      message={helperText}
      width="300px"
    >
      <Select.Root name="category">
        <Select.Trigger id={id} placeholder="Pick a category" />
        <Select.Content>
          <ErrorBoundary
            fallback={<Select.Item value="error">None</Select.Item>}
          >
            <Suspense
              fallback={<Select.Item value="loading">Loading</Select.Item>}
            >
              <CategoryFieldOptions getCategories={promiseCategories} />
            </Suspense>
          </ErrorBoundary>
        </Select.Content>
      </Select.Root>
    </BaseField>
  )
})

interface CategoryFieldInnerProps {
  getCategories: Promise<Category[]>
}

const CategoryFieldOptions = memo(function CategoryFieldInner({
  getCategories,
}: CategoryFieldInnerProps) {
  const categories = use(getCategories)

  return (
    <>
      {categories.map((category) => (
        <Select.Item
          aria-label={category.name}
          key={category.id}
          value={category?.id ?? ""}
        >
          {category.name}
        </Select.Item>
      ))}
    </>
  )
})

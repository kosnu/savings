import { Select } from "@radix-ui/themes"
import { memo, Suspense, use, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { BaseField } from "../../../../components/inputs/BaseField"
import type { Category } from "../../../../types/category"
import { useCategories } from "../../../categories/listCategory/useCategories"

interface CategorySelectProps {
  error?: { message: string }
  helperText?: string
}

export const CategorySelect = memo(function CategorySelect({
  error,
  helperText,
}: CategorySelectProps) {
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
              <CategorySelectOptions getCategories={promiseCategories} />
            </Suspense>
          </ErrorBoundary>
        </Select.Content>
      </Select.Root>
    </BaseField>
  )
})

interface CategorySelectInnerProps {
  getCategories: Promise<Category[]>
}

const CategorySelectOptions = memo(function CategorySelectInner({
  getCategories,
}: CategorySelectInnerProps) {
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

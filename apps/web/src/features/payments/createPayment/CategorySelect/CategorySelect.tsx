import { memo, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Select, SelectItem } from "../../../../components/inputs/Select"
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
  const { promiseCategories } = useCategories()

  return (
    <Select
      label="Category"
      name="category"
      width="300px"
      placeholder="Pick a category"
      error={error}
      helperText={helperText}
    >
      <ErrorBoundary fallback={<SelectItem label="None" value="error" />}>
        <Suspense fallback={<SelectItem label="Loading" value="loading" />}>
          <CategorySelectOptions getCategories={promiseCategories} />
        </Suspense>
      </ErrorBoundary>
    </Select>
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
        <SelectItem
          aria-label={category.name}
          key={category.id}
          label={category.name}
          value={category?.id ?? ""}
        />
      ))}
    </>
  )
})

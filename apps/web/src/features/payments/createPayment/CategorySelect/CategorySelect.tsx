import { memo, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Select, SelectItem } from "../../../../components/inputs/Select"
import type { Category } from "../../../../types/category"
import { useCategories } from "../../../categories/listCategory/useCategories"

export const CategorySelect = memo(function CategorySelect() {
  const { promiseCategories } = useCategories()

  return (
    <Select label="Category" name="category">
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

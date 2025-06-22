import { Suspense, memo, use, useMemo } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Select, SelectItem } from "../../../components/inputs/Select"
import type { Category } from "../../../types/category"
import { useGetCategories } from "./useGetCategories"

export const CategorySelect = memo(function CategorySelect() {
  const { getCategories } = useGetCategories()
  const categoriesPromise = useMemo(() => getCategories(), [getCategories])

  return (
    <Select label="Category" name="category">
      <ErrorBoundary
        fallbackRender={() => <SelectItem label="None" value="error" />}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <CategorySelectOptions getCategories={categoriesPromise} />
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
          key={category.id}
          label={category.name}
          value={category?.id ?? ""}
        />
      ))}
    </>
  )
})

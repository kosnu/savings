import { memo, Suspense, use, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { Category } from "../../../../types/category"
import { useCategories } from "../../../categories/listCategory/useCategories"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
} from "../../components/CategorySelect"

interface CategoryFieldProps {
  error?: boolean
  messages?: string[]
  value?: string
  onChange?: (category: string) => void
}

export const CategoryField = memo(function CategoryField({
  error,
  messages,
  value,
  onChange,
}: CategoryFieldProps) {
  const id = useId()
  const { promise: promiseCategories } = useCategories()

  return (
    <BaseField width="300px">
      <FieldLabel htmlFor={id}>Category</FieldLabel>
      <CategorySelect id={id} value={value} onChange={onChange}>
        <ErrorBoundary fallback={<ErrorCategoryOption />}>
          <Suspense fallback={<LoadingCategoryOption />}>
            <CategoryOptions categoriesPromise={promiseCategories} />
          </Suspense>
        </ErrorBoundary>
      </CategorySelect>
      <FieldMessages error={Boolean(error)} messages={messages} />
    </BaseField>
  )
})

interface CategoryOptionsProps {
  categoriesPromise: Promise<Category[]>
}

const CategoryOptions = memo(function CategoryOptions({ categoriesPromise }: CategoryOptionsProps) {
  const categories = use(categoriesPromise)

  return (
    <>
      {categories.map((category) => (
        <CategoryOption key={category.id} category={category} />
      ))}
    </>
  )
})

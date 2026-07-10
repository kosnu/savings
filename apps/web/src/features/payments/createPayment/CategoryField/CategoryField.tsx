import { memo, Suspense, use, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import type { Category } from "../../../../types/category"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
  useCategories,
} from "../../../categories"

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
  const { t } = useTranslation()
  const { promise: promiseCategories } = useCategories()

  return (
    <BaseField width="300px">
      <FieldLabel htmlFor={id}>{t("payments.category.label")}</FieldLabel>
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

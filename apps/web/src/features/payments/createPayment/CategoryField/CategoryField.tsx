import { memo, Suspense, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import {
  CategoryOption,
  CategorySelect,
  ErrorCategoryOption,
  LoadingCategoryOption,
  useCategories,
  usePrefetchCategories,
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
  usePrefetchCategories()

  return (
    <BaseField width="300px">
      <FieldLabel htmlFor={id}>{t("payments.category.label")}</FieldLabel>
      <CategorySelect id={id} value={value} onChange={onChange}>
        <ErrorBoundary fallback={<ErrorCategoryOption />}>
          <Suspense fallback={<LoadingCategoryOption />}>
            <CategoryOptions />
          </Suspense>
        </ErrorBoundary>
      </CategorySelect>
      <FieldMessages error={Boolean(error)} messages={messages} />
    </BaseField>
  )
})

const CategoryOptions = memo(function CategoryOptions() {
  const { data: categories } = useCategories()

  return (
    <>
      {categories.map((category) => (
        <CategoryOption key={category.id} category={category} />
      ))}
    </>
  )
})

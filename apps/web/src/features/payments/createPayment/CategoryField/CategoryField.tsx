import { memo, Suspense, useEffect, useId, useRef } from "react"
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
import { traceCategorySelect } from "./traceCategorySelect"

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
  const trace = useRef<ReturnType<typeof traceCategorySelect>>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debug") !== "category-select") return

    const currentTrace = traceCategorySelect(id)
    trace.current = currentTrace
    return () => {
      currentTrace.dispose()
      trace.current = null
    }
  }, [id])

  return (
    <BaseField width="300px" maxWidth="100%">
      <FieldLabel htmlFor={id}>{t("payments.category.label")}</FieldLabel>
      <CategorySelect
        size={{ initial: "3", sm: "2" }}
        width="100%"
        id={id}
        keepOpenOnHeightIncrease
        value={value}
        onChange={onChange}
        onOpenChange={(open) => trace.current?.onOpenChange(open)}
      >
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

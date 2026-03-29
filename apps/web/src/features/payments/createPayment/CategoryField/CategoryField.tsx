import { Select } from "@radix-ui/themes"
import { memo, Suspense, use, useId } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import type { Category } from "../../../../types/category"
import { useCategories } from "../../../categories/listCategory/useCategories"

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
      <Select.Root name="category" value={value} onValueChange={(val) => onChange?.(val)}>
        <Select.Trigger id={id} placeholder="Pick a category" />
        <Select.Content>
          <ErrorBoundary fallback={<Select.Item value="error">None</Select.Item>}>
            <Suspense fallback={<Select.Item value="loading">Loading</Select.Item>}>
              <CategoryFieldOptions getCategories={promiseCategories} />
            </Suspense>
          </ErrorBoundary>
        </Select.Content>
      </Select.Root>
      <FieldMessages error={Boolean(error)} messages={messages} />
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
      {categories.map((category) => {
        const id = String(category.id)
        return (
          <Select.Item aria-label={category.name} key={id} value={id}>
            {category.name}
          </Select.Item>
        )
      })}
    </>
  )
})

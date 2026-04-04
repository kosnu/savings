import { Select } from "@radix-ui/themes"
import { useCallback } from "react"

import { Category } from "../../../../types/category"

interface CategorySelectProps {
  id?: string
  value?: string
  allowEmptyOption?: boolean
  children?: React.ReactNode
  onChange?: (category: string) => void
}

const NONE_CATEGORY_VALUE = "none"

export function CategorySelect({
  id,
  value,
  allowEmptyOption = false,
  children,
  onChange,
}: CategorySelectProps) {
  const selectValue = value === "" ? (allowEmptyOption ? NONE_CATEGORY_VALUE : undefined) : value

  const handleChange = useCallback(
    (val: string) => {
      if (val === NONE_CATEGORY_VALUE) {
        onChange?.("")
      } else {
        onChange?.(val)
      }
    },
    [onChange],
  )

  return (
    <Select.Root name="category" value={selectValue} onValueChange={handleChange}>
      <Select.Trigger id={id} placeholder="Pick a category" />
      <Select.Content>
        {allowEmptyOption && <NoneCategoryOption />}
        {children}
      </Select.Content>
    </Select.Root>
  )
}

interface CategoryOptionProps {
  category: Category
}

export function CategoryOption({ category }: CategoryOptionProps) {
  const id = String(category.id)
  return (
    <Select.Item aria-label={category.name} key={id} value={id}>
      {category.name}
    </Select.Item>
  )
}

export function NoneCategoryOption() {
  return <Select.Item value={NONE_CATEGORY_VALUE}>None</Select.Item>
}

export function ErrorCategoryOption() {
  return <Select.Item value="error">Error</Select.Item>
}

export function LoadingCategoryOption() {
  return <Select.Item value="loading">Loading</Select.Item>
}

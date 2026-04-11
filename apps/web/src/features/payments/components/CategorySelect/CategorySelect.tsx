import { Select } from "@radix-ui/themes"
import { type ReactNode, useCallback } from "react"

import { Category } from "../../../../types/category"

interface CategorySelectProps {
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  value?: string
  children?: ReactNode
  onChange?: (category: string) => void
  onOpenChange?: (open: boolean) => void
}

const NONE_CATEGORY_VALUE = "none"

export function CategorySelect({
  autoFocus = false,
  disabled = false,
  id,
  value,
  children,
  onChange,
  onOpenChange,
}: CategorySelectProps) {
  const selectValue = value === undefined || value === "" ? NONE_CATEGORY_VALUE : value

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
    <Select.Root
      disabled={disabled}
      name="category"
      value={selectValue}
      onOpenChange={onOpenChange}
      onValueChange={handleChange}
    >
      <Select.Trigger autoFocus={autoFocus} id={id} placeholder="Pick a category" />
      <Select.Content>
        <NoneCategoryOption />
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
  return (
    <Select.Item disabled value="error">
      Error
    </Select.Item>
  )
}

export function LoadingCategoryOption() {
  return (
    <Select.Item disabled value="loading">
      Loading
    </Select.Item>
  )
}

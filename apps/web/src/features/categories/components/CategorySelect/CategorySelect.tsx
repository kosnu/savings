import { Select } from "@radix-ui/themes"
import { type ComponentProps, type ReactNode, useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { Category } from "../../../../types/category"

import styles from "./CategorySelect.module.css"

interface CategorySelectProps {
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  size?: ComponentProps<typeof Select.Root>["size"]
  width?: string
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
  size,
  width,
  value,
  children,
  onChange,
  onOpenChange,
}: CategorySelectProps) {
  const { t } = useTranslation()
  const selectValue = value === undefined || value === "" ? NONE_CATEGORY_VALUE : value
  const isNoneSelected = selectValue === NONE_CATEGORY_VALUE

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
      size={size}
      value={selectValue}
      onOpenChange={onOpenChange}
      onValueChange={handleChange}
    >
      <Select.Trigger
        autoFocus={autoFocus}
        className={isNoneSelected ? styles.systemLabel : undefined}
        id={id}
        placeholder={t("payments.category.pick")}
        style={{ width }}
      />
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
  const { t } = useTranslation()

  return (
    <Select.Item className={styles.systemLabel} value={NONE_CATEGORY_VALUE}>
      {t("payments.category.none")}
    </Select.Item>
  )
}

export function ErrorCategoryOption() {
  const { t } = useTranslation()

  return (
    <Select.Item disabled value="error">
      {t("payments.category.error")}
    </Select.Item>
  )
}

export function LoadingCategoryOption() {
  const { t } = useTranslation()

  return (
    <Select.Item disabled value="loading">
      {t("payments.category.loading")}
    </Select.Item>
  )
}

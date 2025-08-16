import { type FlexProps, Select as RSelect } from "@radix-ui/themes"
import { type ReactNode, useId } from "react"
import { BaseField } from "../BaseField"
import styles from "./Select.module.css"

type SelectProps = {
  label: React.ReactNode
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  error?: { message: string }
  helperText?: string
  children: ReactNode
} & FlexProps

export function Select({
  label,
  name,
  placeholder,
  required,
  defaultValue,
  error,
  helperText,
  children,
  ...props
}: SelectProps) {
  const id = useId()

  return (
    <BaseField
      label={label}
      htmlFor={id}
      required={required}
      error={Boolean(error)}
      message={helperText}
      {...props}
    >
      <RSelect.Root name={name} required={required} defaultValue={defaultValue}>
        <RSelect.Trigger
          id={id}
          className={styles.selectTrigger}
          placeholder={placeholder}
        />
        <RSelect.Content>{children}</RSelect.Content>
      </RSelect.Root>
    </BaseField>
  )
}

interface SelectItemProps {
  label: ReactNode
  value: string
}

export function SelectItem({ label, value }: SelectItemProps) {
  return <RSelect.Item value={value}>{label}</RSelect.Item>
}

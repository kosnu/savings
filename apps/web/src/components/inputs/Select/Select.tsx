import { Flex, type FlexProps, Select as RSelect, Text } from "@radix-ui/themes"
import { type ReactNode, useId } from "react"
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
    <Flex direction="column" gap="1" {...props}>
      <Text as="label" htmlFor={id} size="2" weight="bold">
        {label}
      </Text>
      <RSelect.Root name={name} required={required} defaultValue={defaultValue}>
        <RSelect.Trigger
          id={id}
          className={styles.selectTrigger}
          placeholder={placeholder}
        />
        <RSelect.Content>{children}</RSelect.Content>
      </RSelect.Root>
      {helperText && (
        <Text as="span" size="1">
          {helperText}
        </Text>
      )}
    </Flex>
  )
}

interface SelectItemProps {
  label: ReactNode
  value: string
}

export function SelectItem({ label, value }: SelectItemProps) {
  return <RSelect.Item value={value}>{label}</RSelect.Item>
}

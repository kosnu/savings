import { Flex, type FlexProps, Select as RSelect, Text } from "@radix-ui/themes"
import { type ReactNode, useId } from "react"
import styles from "./Select.module.css"

type SelectProps = {
  label: React.ReactNode
  name: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  children: ReactNode
} & FlexProps

export function Select({
  label,
  name,
  placeholder,
  required,
  defaultValue,
  children,
  ...props
}: SelectProps) {
  const id = useId()

  return (
    <Flex direction="column" gap="1" {...props}>
      <Text as="label" htmlFor={id} size="2" mb="1" weight="bold">
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

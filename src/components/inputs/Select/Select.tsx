import { Select as RSelect, Text } from "@radix-ui/themes"
import { type ReactNode, useCallback, useId, useState } from "react"
import styles from "./Select.module.css"

type SelectProps = {
  label: React.ReactNode
  name: string
  placeholder?: string
  required?: boolean
  children: ReactNode
}

export function Select({
  label,
  name,
  placeholder,
  required,
  children,
}: SelectProps) {
  const id = useId()
  const [value, setValue] = useState<string>("")

  const handleChange = useCallback((value: string) => {
    setValue(value)
  }, [])

  return (
    <label>
      <Text as="div" size="2" mb="1" weight="bold">
        {label}
      </Text>
      <RSelect.Root
        name={name}
        required={required}
        onValueChange={handleChange}
      >
        <RSelect.Trigger
          className={styles.selectTrigger}
          placeholder={placeholder}
        />
        <RSelect.Content>{children}</RSelect.Content>
      </RSelect.Root>
      <input type="hidden" name={name} id={`${name}-${id}`} value={value} />
    </label>
  )
}

interface SelectItemProps {
  label: ReactNode
  value: string
}

export function SelectItem({ label, value }: SelectItemProps) {
  return <RSelect.Item value={value}>{label}</RSelect.Item>
}

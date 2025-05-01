import { Text, TextField } from "@radix-ui/themes"
import { useId } from "react"

interface TextfieldProps {
  label: React.ReactNode
  name: string
  placeholder?: string
  type?: "text" | "email" | "password" | "number"
  required?: boolean
}

export function Textfield({ label, name, ...props }: TextfieldProps) {
  const id = useId()
  return (
    <label>
      <Text as="div" size="2" mb="1" weight="bold">
        {label}
      </Text>
      <TextField.Root {...props} id={`${name}-${id}`} name={name} />
    </label>
  )
}

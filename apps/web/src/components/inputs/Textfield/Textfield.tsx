import { Text, TextField } from "@radix-ui/themes"
import { useId } from "react"

type RTextFieldRootProps = TextField.RootProps

interface TextfieldProps extends RTextFieldRootProps {
  label: React.ReactNode
  name: string
  placeholder?: string
  type?: "text" | "email" | "password" | "number"
  required?: boolean
  error?: { message: string }
  helperText?: string
}

export function Textfield({
  label,
  name,
  error,
  helperText,
  ...props
}: TextfieldProps) {
  const id = useId()
  return (
    <label>
      <Text as="div" size="2" mb="1" weight="bold">
        {label}
      </Text>
      <TextField.Root {...props} id={`${name}-${id}`} name={name} />
      {helperText && (
        <Text as="span" size="1">
          {helperText}
        </Text>
      )}
    </label>
  )
}

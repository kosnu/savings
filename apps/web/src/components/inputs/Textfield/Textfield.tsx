import { TextField } from "@radix-ui/themes"
import { useId } from "react"
import { BaseField } from "../BaseField"

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
  required = false,
  error,
  helperText,
  ...props
}: TextfieldProps) {
  const id = useId()

  return (
    <BaseField
      label={label}
      htmlFor={id}
      required={required}
      error={Boolean(error)}
      message={helperText}
    >
      <TextField.Root {...props} id={id} name={name} />
    </BaseField>
  )
}

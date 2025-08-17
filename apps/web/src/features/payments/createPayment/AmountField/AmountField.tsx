import { TextField } from "@radix-ui/themes"
import { useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"

interface AmountFieldProps {
  error?: boolean
  message?: string
}

export function AmountField({ error, message }: AmountFieldProps) {
  const id = useId()

  return (
    <BaseField
      label="Amount"
      required
      htmlFor={id}
      error={error}
      message={message}
    >
      <TextField.Root id={id} name="amount" type="text" inputMode="numeric" />
    </BaseField>
  )
}

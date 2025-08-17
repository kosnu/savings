import { useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"
import { DatePicker } from "../../../../components/inputs/DatePicker"

interface PaymentDateFieldProps {
  error?: boolean
  message?: string
}

export function PaymentDateField({ error, message }: PaymentDateFieldProps) {
  const id = useId()

  return (
    <BaseField
      label="Date"
      htmlFor={id}
      required
      error={error}
      message={message}
      width="fit-content"
    >
      <DatePicker id={id} name="date" />
    </BaseField>
  )
}

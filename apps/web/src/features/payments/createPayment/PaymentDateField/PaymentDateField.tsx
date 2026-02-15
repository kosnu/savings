import { Text } from "@radix-ui/themes"
import { Fragment, useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"
import { DatePicker } from "../../../../components/inputs/DatePicker"

interface PaymentDateFieldProps {
  error?: boolean
  messages?: string[]
  value?: Date
  onChange?: (date: Date) => void
}

export function PaymentDateField({
  error,
  messages,
  value,
  onChange,
}: PaymentDateFieldProps) {
  const id = useId()

  const handleChange = (date: Date | undefined) => {
    if (date) {
      onChange?.(date)
    }
  }

  return (
    <BaseField
      label="Date"
      htmlFor={id}
      required
      error={error}
      message={messages?.map((msg, i) => (
        <Fragment key={msg}>
          {i > 0 && <br />}
          <Text as="span">{msg}</Text>
        </Fragment>
      ))}
      width="fit-content"
    >
      <DatePicker
        id={id}
        name="date"
        value={value}
        defaultValue={new Date()}
        onChange={handleChange}
      />
    </BaseField>
  )
}

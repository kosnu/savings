import { Text } from "@radix-ui/themes"
import { Fragment, useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"
import { DatePicker } from "../../../../components/inputs/DatePicker"

interface PaymentDateFieldProps {
  error?: boolean
  messages?: string[]
}

export function PaymentDateField({ error, messages }: PaymentDateFieldProps) {
  const id = useId()
  const defaultValue = new Date()

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
      <DatePicker id={id} name="date" defaultValue={defaultValue} />
    </BaseField>
  )
}

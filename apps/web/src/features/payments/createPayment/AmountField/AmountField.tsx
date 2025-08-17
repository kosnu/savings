import { Text, TextField } from "@radix-ui/themes"
import { Fragment, useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"

interface AmountFieldProps {
  error?: boolean
  messages?: string[]
}

export function AmountField({ error, messages }: AmountFieldProps) {
  const id = useId()

  return (
    <BaseField
      label="Amount"
      required
      htmlFor={id}
      error={error}
      message={messages?.map((msg, i) => (
        <Fragment key={msg}>
          {i > 0 && <br />}
          <Text as="span">{msg}</Text>
        </Fragment>
      ))}
    >
      <TextField.Root id={id} name="amount" type="text" inputMode="numeric" />
    </BaseField>
  )
}

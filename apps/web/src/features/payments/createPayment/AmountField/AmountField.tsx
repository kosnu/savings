import { Text, TextField } from "@radix-ui/themes"
import { Fragment, useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"

interface AmountFieldProps {
  error?: boolean
  messages?: string[]
  value?: number
  onChange?: (amount: number | undefined) => void
}

export function AmountField({
  error,
  messages,
  value,
  onChange,
}: AmountFieldProps) {
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
      <TextField.Root
        id={id}
        name="amount"
        type="text"
        inputMode="numeric"
        value={value?.toString() ?? ""}
        onChange={(e) => {
          const val = e.target.value
          if (val === "") {
            onChange?.(undefined)
            return
          }
          // Only allow numeric input
          if (!/^\d*$/.test(val)) {
            // Ignore non-numeric characters
            return
          }
          const num = Number(val)
          if (!Number.isNaN(num)) {
            onChange?.(num)
          }
        }}
      />
    </BaseField>
  )
}

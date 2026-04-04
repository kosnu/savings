import { TextField } from "@radix-ui/themes"
import { type ChangeEvent } from "react"

interface AmountInputProps {
  id?: string
  value?: number
  autoFocus?: boolean
  disabled?: boolean
  onChange?: (amount: number | undefined) => void
}

export function AmountInput({ id, value, autoFocus, disabled, onChange }: AmountInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
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
  }

  return (
    <TextField.Root
      id={id}
      name="amount"
      type="text"
      inputMode="numeric"
      value={value?.toString() ?? ""}
      autoFocus={autoFocus}
      disabled={disabled}
      onChange={handleChange}
    />
  )
}

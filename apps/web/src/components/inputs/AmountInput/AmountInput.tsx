import { TextField } from "@radix-ui/themes"
import type { ChangeEvent } from "react"

interface AmountInputProps {
  id?: string
  value?: number
  autoFocus?: boolean
  disabled?: boolean
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  onChange?: (amount: number | undefined) => void
}

export function AmountInput({
  id,
  value,
  autoFocus,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  onChange,
}: AmountInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    if (value === "") {
      onChange?.(undefined)
      return
    }
    // Only allow numeric input.
    if (!/^\d*$/.test(value)) {
      return
    }
    const amount = Number(value)
    if (!Number.isNaN(amount)) {
      onChange?.(amount)
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
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      onChange={handleChange}
    />
  )
}

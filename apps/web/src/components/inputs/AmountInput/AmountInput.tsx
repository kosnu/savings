import { TextField } from "@radix-ui/themes"
import type { ChangeEvent, ComponentProps } from "react"

type AmountInputProps = Omit<
  ComponentProps<typeof TextField.Root>,
  "children" | "inputMode" | "onChange" | "type" | "value"
> & {
  value?: string
  onChange?: (value: string) => void
}

export function AmountInput({ name = "amount", onChange, value, ...props }: AmountInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value)
  }

  return (
    <TextField.Root
      {...props}
      name={name}
      type="text"
      inputMode="numeric"
      value={value ?? ""}
      onChange={handleChange}
    />
  )
}

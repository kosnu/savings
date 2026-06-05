import { TextField } from "@radix-ui/themes"
import type { ComponentProps } from "react"

interface Props {
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  size?: ComponentProps<typeof TextField.Root>["size"]
  value?: string
  onChange?: (note: string) => void
}

export function NoteInput({ autoFocus, disabled, id, size, value, onChange }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e.target.value)
  }
  return (
    <TextField.Root
      autoFocus={autoFocus}
      disabled={disabled}
      id={id}
      name="note"
      size={size}
      type="text"
      value={value}
      onChange={handleChange}
    />
  )
}

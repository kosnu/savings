import { TextField } from "@radix-ui/themes"

interface Props {
  autoFocus?: boolean
  disabled?: boolean
  id?: string
  value?: string
  onChange?: (note: string) => void
}

export function NoteInput({ autoFocus, disabled, id, value, onChange }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e.target.value)
  }
  return (
    <TextField.Root
      autoFocus={autoFocus}
      disabled={disabled}
      id={id}
      name="note"
      type="text"
      value={value}
      onChange={handleChange}
    />
  )
}

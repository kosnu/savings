import { TextField } from "@radix-ui/themes"

interface Props {
  id?: string
  value?: string
  onChange?: (note: string) => void
}

export function NoteInput({ id, value, onChange }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e.target.value)
  }
  return <TextField.Root id={id} name="note" type="text" value={value} onChange={handleChange} />
}

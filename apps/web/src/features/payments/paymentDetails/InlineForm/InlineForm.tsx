import type { KeyboardEvent, ReactNode, SubmitEvent } from "react"

interface InlineFormProps {
  children: ReactNode
  onSubmit?: () => void | Promise<void>
  onCancel?: () => void
  saving?: boolean
}

export function InlineForm({ children, onSubmit, onCancel, saving = false }: InlineFormProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return

    event.preventDefault()
    event.stopPropagation()
    if (!saving) {
      onCancel?.()
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    void onSubmit?.()
  }

  return (
    <form onKeyDownCapture={handleKeyDown} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}

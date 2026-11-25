import { Flex } from "@radix-ui/themes"
import type { KeyboardEvent, ReactNode, SubmitEvent } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { FieldMessages } from "../../../../components/inputs/BaseField"
import { SubmitIconButton } from "../SubmitIconButton"

interface InlineFormProps {
  children: ReactNode
  onSubmit?: () => void | Promise<void>
  onCancel?: () => void
  saving?: boolean
  submitLabel?: string
  messages?: string[]
}

export function InlineForm({
  children,
  onSubmit,
  onCancel,
  saving = false,
  submitLabel,
  messages,
}: InlineFormProps) {
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
      {submitLabel ? (
        <Flex direction={{ initial: "column", sm: "row" }} gap="3">
          <Flex direction="column" gap="1" flexGrow="1" minWidth="0">
            {children}
            <FieldMessages error messages={messages} />
          </Flex>
          <Flex gap="3" justify="end" align="start">
            <Flex display={{ initial: "flex", sm: "none" }}>
              <CancelButton size="3" onClick={onCancel} disabled={saving} />
            </Flex>
            <SubmitIconButton ariaLabel={submitLabel} loading={saving} showMobileLabel />
          </Flex>
        </Flex>
      ) : (
        children
      )}
    </form>
  )
}

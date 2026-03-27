import { Button } from "@radix-ui/themes"
import type { MouseEventHandler, ReactNode } from "react"

interface CancelButtonProps {
  children?: ReactNode
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined
}

export function CancelButton({
  children = "Cancel",
  disabled = false,
  onClick,
}: CancelButtonProps) {
  return (
    <Button type="button" variant="soft" color="gray" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

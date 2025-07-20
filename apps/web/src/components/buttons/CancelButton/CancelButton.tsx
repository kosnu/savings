import { Button } from "@radix-ui/themes"
import type { MouseEventHandler, ReactNode } from "react"

interface CancelButtonProps {
  children?: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined
}

export function CancelButton({
  children = "Cancel",
  onClick,
}: CancelButtonProps) {
  return (
    <Button variant="soft" color="gray" onClick={onClick}>
      {children}
    </Button>
  )
}

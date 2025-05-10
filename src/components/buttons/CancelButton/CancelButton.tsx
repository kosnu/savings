import { Button } from "@radix-ui/themes"
import type { ReactNode } from "react"

interface CancelButtonProps {
  children?: ReactNode
}

export function CancelButton({ children = "Cancel" }: CancelButtonProps) {
  return (
    <Button variant="soft" color="gray">
      {children}
    </Button>
  )
}

import { Button, type ButtonProps } from "@radix-ui/themes"
import type { MouseEventHandler, ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface CancelButtonProps {
  children?: ReactNode
  disabled?: boolean
  size?: ButtonProps["size"]
  onClick?: MouseEventHandler<HTMLButtonElement> | undefined
}

export function CancelButton({ children, disabled = false, size, onClick }: CancelButtonProps) {
  const { t } = useTranslation()

  return (
    <Button
      type="button"
      variant="soft"
      color="gray"
      size={size}
      disabled={disabled}
      onClick={onClick}
    >
      {children ?? t("common.cancel")}
    </Button>
  )
}

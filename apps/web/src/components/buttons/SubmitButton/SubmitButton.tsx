import { Button, type ButtonProps, Spinner } from "@radix-ui/themes"
import { useFormStatus } from "react-dom"
import { useTranslation } from "react-i18next"

type SubmitButtonProps = ButtonProps

export function SubmitButton({ children, loading, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  const { t } = useTranslation()

  const isLoading = !!loading || pending
  const isDisabled = !!disabled || isLoading

  return (
    <Button type="submit" {...props} disabled={isDisabled}>
      {isLoading && <Spinner aria-label={t("common.loadingSpinner")} />}
      {children}
    </Button>
  )
}

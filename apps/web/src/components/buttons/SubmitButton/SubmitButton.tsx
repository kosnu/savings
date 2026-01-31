import { Button, type ButtonProps, Spinner } from "@radix-ui/themes"
import { useFormStatus } from "react-dom"

type SubmitButtonProps = ButtonProps

export function SubmitButton({
  children,
  loading,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  const isLoading = loading || pending
  const isDisabled = disabled || isLoading

  return (
    <Button type="submit" {...props} disabled={isDisabled}>
      {isLoading && <Spinner aria-label="loading-spinner" />}
      {children}
    </Button>
  )
}

import { Button, type ButtonProps, Spinner } from "@radix-ui/themes"

type SubmitButtonProps = ButtonProps

export function SubmitButton({
  children,
  loading,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" {...props} disabled={loading || disabled}>
      {loading && <Spinner aria-label="loading-spinner" />}
      {children}
    </Button>
  )
}

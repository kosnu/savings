import { Button, type ButtonProps, Spinner } from "@radix-ui/themes"

type SubmitButtonProps = ButtonProps

export function SubmitButton({
  children,
  loading,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={loading} {...props}>
      {loading && <Spinner aria-label="loading-spinner" loading />}
      {children}
    </Button>
  )
}

import { Button, type ButtonProps, Spinner } from "@radix-ui/themes"

interface SubmitButtonProps extends ButtonProps {}

export function SubmitButton({
  children,
  loading,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={loading} {...props}>
      {loading && <Spinner loading />}
      {children}
    </Button>
  )
}

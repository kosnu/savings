import { CheckIcon } from "@radix-ui/react-icons"
import { IconButton, Spinner } from "@radix-ui/themes"

interface SubmitIconButtonProps {
  ariaLabel: string
  loading?: boolean
  disabled?: boolean
}

export function SubmitIconButton({
  ariaLabel,
  loading = false,
  disabled = false,
}: SubmitIconButtonProps) {
  return (
    <IconButton
      aria-label={ariaLabel}
      disabled={disabled || loading}
      size="2"
      type="submit"
      variant="solid"
    >
      {loading ? <Spinner aria-label="saving" /> : <CheckIcon />}
    </IconButton>
  )
}

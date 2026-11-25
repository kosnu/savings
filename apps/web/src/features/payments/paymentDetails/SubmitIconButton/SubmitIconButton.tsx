import { CheckIcon } from "@radix-ui/react-icons"
import { Box, Button, IconButton, Spinner } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

interface SubmitIconButtonProps {
  ariaLabel: string
  loading?: boolean
  disabled?: boolean
  showMobileLabel?: boolean
}

export function SubmitIconButton({
  ariaLabel,
  loading = false,
  disabled = false,
  showMobileLabel = false,
}: SubmitIconButtonProps) {
  const { t } = useTranslation()
  const icon = loading ? <Spinner aria-label="saving" /> : <CheckIcon />

  if (showMobileLabel) {
    return (
      <Button
        aria-label={ariaLabel}
        disabled={disabled || loading}
        size={{ initial: "3", sm: "2" }}
        type="submit"
        variant="solid"
      >
        <Box asChild display={loading ? "inline-block" : { initial: "none", sm: "inline-block" }}>
          <span>{icon}</span>
        </Box>
        <Box asChild display={{ initial: "inline", sm: "none" }}>
          <span>{t("common.save")}</span>
        </Box>
      </Button>
    )
  }

  return (
    <IconButton
      aria-label={ariaLabel}
      disabled={disabled || loading}
      size="2"
      type="submit"
      variant="solid"
    >
      {icon}
    </IconButton>
  )
}

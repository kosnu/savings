import { CheckIcon } from "@radix-ui/react-icons"
import { Button, IconButton, Spinner } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { MOBILE_OVERLAY_MEDIA_QUERY } from "../../../../components/overlay/constants"
import { useMediaQuery } from "../../../../utils/useMediaQuery"

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
  const mobile = useMediaQuery(MOBILE_OVERLAY_MEDIA_QUERY)
  const icon = loading ? <Spinner aria-label="saving" /> : <CheckIcon />

  if (showMobileLabel && mobile) {
    return (
      <Button
        aria-label={ariaLabel}
        disabled={disabled || loading}
        size="3"
        type="submit"
        variant="solid"
      >
        {loading ? icon : null}
        {t("common.save")}
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

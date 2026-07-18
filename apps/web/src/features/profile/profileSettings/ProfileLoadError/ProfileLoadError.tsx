import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex, Spinner } from "@radix-ui/themes"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface ProfileLoadErrorProps {
  onRetry: () => Promise<void> | void
}

export function ProfileLoadError({ onRetry }: ProfileLoadErrorProps) {
  const { t } = useTranslation()
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      await onRetry()
    } catch {
      retryButtonRef.current?.focus({ preventScroll: true })
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Flex direction="column" gap="3" align="start">
      <Callout.Root role="alert" color="red" variant="surface" size="1">
        <Callout.Icon>
          <ExclamationTriangleIcon />
        </Callout.Icon>
        <Callout.Text>{t("profile.loadError")}</Callout.Text>
      </Callout.Root>
      <Button
        ref={retryButtonRef}
        type="button"
        variant="soft"
        size="2"
        disabled={isRetrying}
        aria-busy={isRetrying}
        onClick={() => void handleRetry()}
      >
        {isRetrying ? <Spinner aria-label={t("common.loadingSpinner")} /> : null}
        {t("profile.retry")}
      </Button>
    </Flex>
  )
}

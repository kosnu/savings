import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog, IconButton } from "@radix-ui/themes"
import type { CSSProperties, ReactNode } from "react"

import { useMediaQuery } from "../../../utils/useMediaQuery"
import { MOBILE_OVERLAY_MEDIA_QUERY } from "../constants"

import styles from "./ResponsiveOverlay.module.css"

interface ResponsiveOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description?: ReactNode
  children: ReactNode
  dismissible?: boolean
}

export function ResponsiveOverlay({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  dismissible = true,
}: ResponsiveOverlayProps) {
  const isMobile = useMediaQuery(MOBILE_OVERLAY_MEDIA_QUERY)
  const contentClassName = [styles.content, isMobile ? styles.sheetContent : styles.dialogContent]
    .filter(Boolean)
    .join(" ")
  const mobileContentStyle: CSSProperties | undefined = isMobile
    ? {
        position: "fixed",
        inset: 0,
        transform: "none",
        width: "100vw",
        maxWidth: "none",
        height: "100dvh",
        margin: 0,
        maxHeight: "none",
        borderRadius: 0,
      }
    : undefined

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger>{trigger}</Dialog.Trigger> : null}
      <Dialog.Content
        className={contentClassName}
        data-overlay-variant={isMobile ? "sheet" : "dialog"}
        onEscapeKeyDown={(event) => {
          if (!dismissible) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (!dismissible) {
            event.preventDefault()
          }
        }}
        style={mobileContentStyle}
      >
        {isMobile && dismissible ? (
          <div className={styles.mobileHeader}>
            <Dialog.Close>
              <IconButton
                aria-label={`Close ${title}`}
                className={styles.closeButton}
                size="2"
                variant="ghost"
              >
                <Cross1Icon />
              </IconButton>
            </Dialog.Close>
          </div>
        ) : null}
        {/* 必要になれば Escape と outside click は別 prop に分けて制御できる。 */}
        <Dialog.Title className={isMobile ? styles.mobileTitle : undefined}>{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className={styles.description} size="2">
            {description}
          </Dialog.Description>
        ) : null}
        {children}
      </Dialog.Content>
    </Dialog.Root>
  )
}

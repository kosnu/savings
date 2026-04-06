import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog, IconButton } from "@radix-ui/themes"
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from "react"

import { useMediaQuery } from "../../../utils/useMediaQuery"
import { MOBILE_OVERLAY_MEDIA_QUERY } from "../constants"

import styles from "./ResponsiveOverlay.module.css"

interface ResponsiveOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Dialog.Trigger には props / ref を受け取れる単一要素を渡す。
  // Fragment や複数要素、props を透過しない要素は想定しない。
  trigger?: ReactElement
  title: string
  description?: ReactNode
  children: ReactNode
  dismissible?: boolean
  onEscapeKeyDown?: ComponentProps<typeof Dialog.Content>["onEscapeKeyDown"]
}

export function ResponsiveOverlay({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  dismissible = true,
  onEscapeKeyDown,
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
          onEscapeKeyDown?.(event)
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
        {dismissible ? (
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

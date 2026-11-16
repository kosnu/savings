import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Box, IconButton } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

import { Logo } from "../../components/misc/Logo"

import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick?: () => void
  menuButtonRef?: Ref<HTMLButtonElement>
  sidebarId?: string
  sidebarOpen?: boolean
  action?: ReactNode
  sticky?: boolean
}

const iconSize = { width: "22", height: "22" }

export function Header({
  onMenuClick,
  menuButtonRef,
  sidebarId,
  sidebarOpen,
  action,
  sticky = false,
}: HeaderProps) {
  const { t } = useTranslation()

  if (!onMenuClick && !action) return null

  return (
    <header className={styles.header} data-sticky={sticky}>
      {onMenuClick && (
        <>
          <IconButton
            ref={menuButtonRef}
            aria-label={t("header.menu")}
            aria-expanded={sidebarOpen}
            aria-controls={sidebarId}
            size="3"
            variant="ghost"
            onClick={onMenuClick}
          >
            <HamburgerMenuIcon {...iconSize} />
          </IconButton>
          <IconButton
            asChild
            aria-label={t("header.logo", { appName: t("app.name") })}
            size="3"
            radius="full"
            variant="ghost"
          >
            <Link to="/">
              <Logo width={32} height={32} alt="" />
            </Link>
          </IconButton>
        </>
      )}
      <Box style={{ flexGrow: 1 }} />
      {action}
    </header>
  )
}

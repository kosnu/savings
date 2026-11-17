import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Box, IconButton } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import type { ReactNode, Ref } from "react"
import { useTranslation } from "react-i18next"

import { Logo } from "../../components/misc/Logo"

import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick?: () => void
  desktopMenu?: boolean
  menuButtonRef?: Ref<HTMLButtonElement>
  sidebarId?: string
  sidebarOpen?: boolean
  action?: ReactNode
  sticky?: boolean
}

const iconSize = { width: "22", height: "22" }

export function Header({
  onMenuClick,
  desktopMenu = false,
  menuButtonRef,
  sidebarId,
  sidebarOpen,
  action,
  sticky = false,
}: HeaderProps) {
  const { t } = useTranslation()

  if (!onMenuClick && !action) return null

  const menuLabel = desktopMenu
    ? t(sidebarOpen ? "header.closeSidebar" : "header.openSidebar")
    : t("header.menu")

  return (
    <header className={styles.header} data-desktop-menu={desktopMenu} data-sticky={sticky}>
      {onMenuClick && (
        <>
          <IconButton
            ref={menuButtonRef}
            aria-label={menuLabel}
            aria-expanded={sidebarOpen}
            aria-controls={sidebarId}
            size={desktopMenu ? "2" : "3"}
            color={desktopMenu ? "gray" : undefined}
            variant="ghost"
            onClick={onMenuClick}
          >
            {desktopMenu ? (
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            ) : (
              <HamburgerMenuIcon {...iconSize} />
            )}
          </IconButton>
          {!desktopMenu && (
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
          )}
        </>
      )}
      <Box style={{ flexGrow: 1 }} />
      {action}
    </header>
  )
}

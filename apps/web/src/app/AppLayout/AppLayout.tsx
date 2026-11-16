import { Flex, Separator } from "@radix-ui/themes"
import { Outlet } from "@tanstack/react-router"
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { useMediaQuery } from "../../utils/useMediaQuery"
import { Header } from "../Header"
import { Sidebar } from "../Sidebar"
import { SidebarButton } from "../Sidebar/SidebarButton"
import { useSidebar } from "../Sidebar/useSidebar"

import styles from "./AppLayout.module.css"

// Radix Themes の md から、本文と並べてメニューを表示する。
const DESKTOP_SIDEBAR_MEDIA_QUERY = "(min-width: 1024px)"

interface AppLayoutProps {
  children?: ReactNode
  headerAction?: ReactNode
  stickyHeader?: boolean
}

export function AppLayout({ children, headerAction, stickyHeader = false }: AppLayoutProps) {
  const desktop = useMediaQuery(DESKTOP_SIDEBAR_MEDIA_QUERY)
  const { open, openSidebar, closeSidebar } = useSidebar()
  const sidebarId = useId()
  const menuButton = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (desktop) closeSidebar()
  }, [closeSidebar, desktop])

  const dismissSidebar = useCallback(() => {
    closeSidebar()
    menuButton.current?.focus()
  }, [closeSidebar])

  return (
    <Flex className={styles.layout} data-desktop={desktop} data-sticky-header={stickyHeader}>
      <Sidebar id={sidebarId} permanent={desktop} open={open} onClose={dismissSidebar}>
        <SidebarButton
          to="/"
          ariaLabel={t("navigation.homeAria")}
          label={t("navigation.home")}
          onClick={dismissSidebar}
        />
        <SidebarButton
          to="/payments"
          ariaLabel={t("navigation.paymentsAria")}
          label={t("navigation.payments")}
          onClick={dismissSidebar}
        />
        <Separator orientation="horizontal" size="4" decorative />
        <SidebarButton
          to="/settings"
          ariaLabel={t("navigation.settingsAria")}
          label={t("navigation.settings")}
          onClick={dismissSidebar}
        />
      </Sidebar>

      <Flex direction="column" flexGrow="1" minWidth="0">
        <Header
          onMenuClick={desktop ? undefined : openSidebar}
          menuButtonRef={menuButton}
          sidebarId={sidebarId}
          sidebarOpen={open}
          action={headerAction}
          sticky={stickyHeader}
        />
        <main className={styles.main}>{children ?? <Outlet />}</main>
      </Flex>
    </Flex>
  )
}

import { GearIcon, HomeIcon, ListBulletIcon } from "@radix-ui/react-icons"
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
const DESKTOP_SIDEBAR_STORAGE_KEY = "desktopSidebarOpen"

interface AppLayoutProps {
  children?: ReactNode
  headerAction?: ReactNode
  stickyHeader?: boolean
}

export function AppLayout({ children, headerAction, stickyHeader = true }: AppLayoutProps) {
  const desktop = useMediaQuery(DESKTOP_SIDEBAR_MEDIA_QUERY)
  const { open: drawerOpen, openSidebar, closeSidebar } = useSidebar()
  const { open: desktopSidebarOpen, toggleSidebar } = useSidebar(true, DESKTOP_SIDEBAR_STORAGE_KEY)
  const sidebarOpen = desktop ? desktopSidebarOpen : drawerOpen
  const iconOnly = desktop && !desktopSidebarOpen
  const sidebarId = useId()
  const menuButton = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (desktop) closeSidebar()
  }, [closeSidebar, desktop])

  const dismissSidebar = useCallback(() => {
    if (desktop) return

    closeSidebar()
    menuButton.current?.focus()
  }, [closeSidebar, desktop])

  return (
    <Flex
      className={styles.layout}
      data-desktop={desktop}
      data-sidebar-open={sidebarOpen}
      data-sticky-header={stickyHeader}
    >
      <Sidebar id={sidebarId} permanent={desktop} open={sidebarOpen} onClose={dismissSidebar}>
        <SidebarButton
          to="/"
          ariaLabel={t("navigation.homeAria")}
          label={t("navigation.home")}
          iconOnly={iconOnly}
          icon={<HomeIcon aria-hidden />}
          onClick={dismissSidebar}
        />
        <SidebarButton
          to="/payments"
          ariaLabel={t("navigation.paymentsAria")}
          label={t("navigation.payments")}
          iconOnly={iconOnly}
          icon={<ListBulletIcon aria-hidden />}
          onClick={dismissSidebar}
        />
        <Separator orientation="horizontal" size="4" decorative />
        <SidebarButton
          to="/settings"
          ariaLabel={t("navigation.settingsAria")}
          label={t("navigation.settings")}
          iconOnly={iconOnly}
          icon={<GearIcon aria-hidden />}
          onClick={dismissSidebar}
        />
      </Sidebar>

      <Flex direction="column" flexGrow="1" minWidth="0">
        <Header
          onMenuClick={desktop ? toggleSidebar : openSidebar}
          desktopMenu={desktop}
          menuButtonRef={menuButton}
          sidebarId={sidebarId}
          sidebarOpen={sidebarOpen}
          action={headerAction}
          sticky={stickyHeader}
        />
        <main className={styles.main}>{children ?? <Outlet />}</main>
      </Flex>
    </Flex>
  )
}

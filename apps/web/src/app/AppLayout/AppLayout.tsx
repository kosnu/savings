import { Flex, Separator } from "@radix-ui/themes"
import { Outlet } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Header } from "../Header"
import { Sidebar } from "../Sidebar"
import { SidebarButton } from "../Sidebar/SidebarButton"
import { useSidebar } from "../Sidebar/useSidebar"

import styles from "./AppLayout.module.css"

export function AppLayout() {
  const { open, openSidebar, closeSidebar } = useSidebar()
  const { t } = useTranslation()

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <Sidebar open={open} onClose={closeSidebar}>
        <SidebarButton
          to="/payments"
          ariaLabel={t("navigation.paymentsAria")}
          label={t("navigation.payments")}
          onClick={closeSidebar}
        />
        <Separator orientation="horizontal" size="4" decorative />
        <SidebarButton
          to="/settings"
          ariaLabel={t("navigation.settingsAria")}
          label={t("navigation.settings")}
          onClick={closeSidebar}
        />
      </Sidebar>

      <Flex direction="column" flexGrow="1">
        <Header onMenuClick={openSidebar} />
        {/* Main Content */}
        <main className={styles.main}>
          <Outlet />
        </main>
      </Flex>
    </Flex>
  )
}

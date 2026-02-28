import { CalendarIcon } from "@radix-ui/react-icons"
import { Flex } from "@radix-ui/themes"
import { Outlet } from "@tanstack/react-router"
import { Header } from "../Header"
import { Sidebar, useSidebar } from "../Sidebar"
import { SidebarButton } from "../Sidebar/SidebarButton"
import styles from "./AppLayout.module.css"

export function AppLayout() {
  const { open, openSidebar, closeSidebar } = useSidebar()

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <Sidebar open={open} onClose={closeSidebar}>
        <SidebarButton
          to="/payments"
          label={
            <>
              <CalendarIcon /> Payments
            </>
          }
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

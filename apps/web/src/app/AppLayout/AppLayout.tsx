import { Flex } from "@radix-ui/themes"
import { Outlet } from "react-router-dom"
import { SidebarTreeButton } from "../../components/buttons/SidebarTreeButton"
import { useAuthCheck } from "../../utils/auth/useAuthCheck"
import { Header } from "../Header"
import { Sidebar, useSidebar } from "../Sidebar"
import styles from "./AppLayout.module.css"
import { getPaymentsSidebarTree } from "./getPaymentsSidebarTree"

export function AppLayout() {
  useAuthCheck()
  const { open, openSidebar, closeSidebar } = useSidebar()

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <Sidebar open={open} onClose={closeSidebar}>
        <SidebarTreeButton
          treeObject={getPaymentsSidebarTree(new Date())}
          onLinkClick={closeSidebar}
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

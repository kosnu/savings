import { Button, Flex, Text } from "@radix-ui/themes"
import { Link, Outlet } from "react-router-dom"
import { paths } from "../../config/paths"
import { useAuthCheck } from "../../utils/auth/useAuthCheck"
import { Header } from "../Header"
import { Sidebar, useSidebar } from "../Sidebar"
import styles from "./AppLayout.module.css"

export function AppLayout() {
  useAuthCheck()
  const { open, openSidebar, closeSidebar } = useSidebar()

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <Sidebar open={open} onClose={closeSidebar}>
        <Link to={paths.payments.getHref()} onClick={closeSidebar}>
          <Button
            aria-label="Navigate to Payments page"
            variant="ghost"
            size="3"
          >
            <Text>Payments</Text>
          </Button>
        </Link>
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

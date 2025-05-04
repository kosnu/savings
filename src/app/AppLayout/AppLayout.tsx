import { CardStackIcon } from "@radix-ui/react-icons"
import { Button, Flex, Separator, Text } from "@radix-ui/themes"
import { useState } from "react"
import { Link, Outlet } from "react-router-dom"
import { paths } from "../../config/paths"
import styles from "./AppLayout.module.css"

export function AppLayout() {
  const [isSidebarOpen] = useState(true)

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${isSidebarOpen ? styles.open : styles.closed}`}
      >
        {/* Sidebar Header */}
        <Flex className={styles.sidebarHeader} p="4">
          <Link to={paths.root.getHref()} className={styles.link}>
            <Button className={styles.sidebarButton} variant="ghost" size="3">
              <Text size="3" weight="bold">
                My Savings
              </Text>
            </Button>
          </Link>
        </Flex>
        <Separator size="4" />
        {/* Sidebar Contents */}
        <Flex className={styles.sidebarContents} align="start" gap="2" p="4">
          <Link to={paths.payments.getHref()} className={styles.link}>
            <Button className={styles.sidebarButton} variant="ghost" size="3">
              <CardStackIcon />
              Payments
            </Button>
          </Link>
        </Flex>
        <Separator size="4" />
        {/* Sidebar Footer */}
        <Flex className={styles.sidebarFooter} p="4" />
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </Flex>
  )
}

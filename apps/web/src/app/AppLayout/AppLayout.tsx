import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Button, Flex, IconButton, Separator, Text } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { Link, Outlet } from "react-router-dom"
import { SidebarTreeButton } from "../../components/buttons/SidebarTreeButton"
import { paths } from "../../config/paths"
import styles from "./AppLayout.module.css"
import { getPaymentsSidebarTree } from "./getPaymentsSidebarTree"

export function AppLayout() {
  const [isSidebarOpen, setIsSideberOpen] = useState(true)

  const handleMenuClick = useCallback(() => {
    setIsSideberOpen((value) => !value)
  }, [])

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
          <SidebarTreeButton treeObject={getPaymentsSidebarTree(new Date())} />
        </Flex>
        <Separator size="4" />
        {/* Sidebar Footer */}
        <Flex className={styles.sidebarFooter} p="4" />
      </aside>

      <Flex direction="column" flexGrow="1">
        <header className={styles.header}>
          <IconButton variant="surface" onClick={handleMenuClick}>
            <HamburgerMenuIcon width="18" height="18" />
          </IconButton>
        </header>
        {/* Main Content */}
        <main className={styles.main}>
          <Outlet />
        </main>
      </Flex>
    </Flex>
  )
}

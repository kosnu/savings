import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Flex, IconButton } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { Outlet } from "react-router-dom"
import { SidebarTreeButton } from "../../components/buttons/SidebarTreeButton"
import { Sidebar } from "../../shared/sidebar"
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
      <Sidebar open={isSidebarOpen}>
        <Flex className={styles.sidebarContents} align="start" gap="2" p="4">
          <SidebarTreeButton treeObject={getPaymentsSidebarTree(new Date())} />
        </Flex>
      </Sidebar>

      <Flex direction="column" flexGrow="1">
        <Header onMenuClick={handleMenuClick} />
        {/* Main Content */}
        <main className={styles.main}>
          <Outlet />
        </main>
      </Flex>
    </Flex>
  )
}

interface HeaderProps {
  onMenuClick: () => void
}

function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <IconButton variant="surface" onClick={onMenuClick}>
        <HamburgerMenuIcon width="18" height="18" />
      </IconButton>
    </header>
  )
}

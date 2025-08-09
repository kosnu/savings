import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { Flex, IconButton } from "@radix-ui/themes"
import { Outlet } from "react-router-dom"
import { SidebarTreeButton } from "../../components/buttons/SidebarTreeButton"
import { Sidebar } from "../../shared/sidebar"
import { useSidebar } from "../../shared/sidebar/hooks/useSidebar"
import styles from "./AppLayout.module.css"
import { getPaymentsSidebarTree } from "./getPaymentsSidebarTree"

export function AppLayout() {
  const { open, toggleSidebar } = useSidebar()

  return (
    <Flex className={styles.layout}>
      {/* Sidebar */}
      <Sidebar open={open}>
        <Flex className={styles.sidebarContents} align="start" gap="2" p="4">
          <SidebarTreeButton treeObject={getPaymentsSidebarTree(new Date())} />
        </Flex>
      </Sidebar>

      <Flex direction="column" flexGrow="1">
        <Header onMenuClick={toggleSidebar} />
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

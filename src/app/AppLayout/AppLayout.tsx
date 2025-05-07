import { CalendarIcon } from "@radix-ui/react-icons"
import { Button, Flex, Separator, Text } from "@radix-ui/themes"
import { useState } from "react"
import { Link, Outlet } from "react-router-dom"
import { SidebarTreeButton } from "../../components/buttons/SidebarTreeButton"
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
          <SidebarTreeButton treeObject={objects} />
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

// 仮のサンプルデータ
const objects = {
  id: "title",
  icon: <CalendarIcon />,
  label: "Payments",
  children: [
    {
      id: "2025",
      label: "2025年",
      children: [
        {
          id: "01",
          label: "1月",
          href: paths.payments.getHref("2025", "01"),
        },
        {
          id: "02",
          label: "2月",
          href: paths.payments.getHref("2025", "02"),
        },
        {
          id: "03",
          label: "3月",
        },
      ],
    },
    {
      id: "2024",
      label: "2024年",
      children: [
        {
          id: "01",
          label: "1月",
          href: paths.payments.getHref("2024", "01"),
        },
        {
          id: "02",
          label: "2月",
          href: paths.payments.getHref("2024", "02"),
        },
      ],
    },
    {
      id: "2023",
      label: "2023年",
      children: [],
    },
  ],
}

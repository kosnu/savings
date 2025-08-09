import { Button, Flex, Separator, Text } from "@radix-ui/themes"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { paths } from "../../../../config/paths"
import styles from "./Sidebar.module.css"

interface SidebarProps {
  open: boolean
  children?: ReactNode
}

export function Sidebar({ open, children }: SidebarProps) {
  return (
    <aside data-open={open} className={styles.sidebar}>
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
      {children}
      <Separator size="4" />
      {/* Sidebar Footer */}
      <Flex className={styles.sidebarFooter} p="4" />
    </aside>
  )
}

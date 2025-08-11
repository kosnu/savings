import { Cross1Icon } from "@radix-ui/react-icons"
import { Button, Flex, IconButton, Separator, Text } from "@radix-ui/themes"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { paths } from "../../config/paths"
import styles from "./Sidebar.module.css"

interface SidebarProps {
  children?: ReactNode
  open: boolean
  onClose: () => void
}

export function Sidebar({ children, open, onClose }: SidebarProps) {
  return (
    <aside data-open={open} className={styles.sidebar}>
      {/* Sidebar Header */}
      <Flex
        className={styles.sidebarHeader}
        p="4"
        justify="between"
        align="center"
        gap="4"
      >
        <Link to={paths.root.getHref()} className={styles.link}>
          <Button className={styles.sidebarButton} variant="ghost" size="3">
            <Text size="3" weight="bold">
              My Savings
            </Text>
          </Button>
        </Link>
        <IconButton variant="ghost" onClick={onClose}>
          <Cross1Icon />
        </IconButton>
      </Flex>
      <Separator size="4" />
      {/* Sidebar Contents */}
      <Flex className={styles.sidebarContents} align="start" gap="2" p="4">
        {children}
      </Flex>
      <Separator size="4" />
      {/* Sidebar Footer */}
      <Flex className={styles.sidebarFooter} p="4" />
    </aside>
  )
}

import { Button } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import styles from "./SidebarButton.module.css"

interface SidebarButtonProps {
  to: string
  label: ReactNode
  icon?: ReactNode
  ariaLabel: string
  onClick?: () => void
}

export function SidebarButton({ to, label, icon, ariaLabel, onClick }: SidebarButtonProps) {
  return (
    <Button
      asChild
      aria-label={ariaLabel}
      className={styles.sidebarButton}
      variant="ghost"
      color="gray"
      size="3"
      onClick={onClick}
    >
      <Link
        to={to}
        activeOptions={{ exact: to === "/", includeSearch: false }}
        className={styles.sidebarButtonLink}
      >
        {icon}
        {label}
      </Link>
    </Button>
  )
}

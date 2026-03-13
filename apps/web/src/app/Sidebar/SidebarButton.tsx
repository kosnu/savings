import { Button } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import styles from "./SidebarButton.module.css"

interface SidebarButtonProps {
  to: string
  label: ReactNode
  onClick?: () => void
}

export function SidebarButton({ to, label, onClick }: SidebarButtonProps) {
  return (
    <Button
      asChild
      aria-label={`Navigate to ${label} page`}
      className={styles.sidebarButton}
      variant="ghost"
      size="3"
      onClick={onClick}
    >
      <Link to={to} className={styles.sidebarButtonLink}>
        {label}
      </Link>
    </Button>
  )
}

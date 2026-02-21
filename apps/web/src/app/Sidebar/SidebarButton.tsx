import { Button } from "@radix-ui/themes"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import styles from "./SidebarButton.module.css"

interface SidebarButtonProps {
  path: string
  label: ReactNode
  onClick?: () => void
}

export function SidebarButton({ path, label, onClick }: SidebarButtonProps) {
  return (
    <Button
      asChild
      aria-label={`Navigate to ${label} page`}
      className={styles.sidebarButton}
      variant="ghost"
      size="3"
      onClick={onClick}
    >
      <Link to={path} className={styles.sidebarButtonLink}>
        {label}
      </Link>
    </Button>
  )
}

import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { IconButton } from "@radix-ui/themes"
import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <IconButton variant="surface" onClick={onMenuClick}>
        <HamburgerMenuIcon width="18" height="18" />
      </IconButton>
    </header>
  )
}

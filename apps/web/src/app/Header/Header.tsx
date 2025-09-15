import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { IconButton } from "@radix-ui/themes"
import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <IconButton size="3" variant="ghost" onClick={onMenuClick}>
        <HamburgerMenuIcon width="22" height="22" />
      </IconButton>
    </header>
  )
}

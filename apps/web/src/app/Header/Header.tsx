import { HamburgerMenuIcon } from "@radix-ui/react-icons"
import { IconButton } from "@radix-ui/themes"
import { Link } from "react-router-dom"
import { Logo } from "../../components/misc/Logo"
import { paths } from "../../config/paths"
import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <IconButton
        aria-label="Menu button"
        size="3"
        variant="ghost"
        onClick={onMenuClick}
      >
        <HamburgerMenuIcon width="22" height="22" />
      </IconButton>
      <IconButton
        asChild
        aria-label="Logo button"
        size="3"
        radius="full"
        variant="ghost"
      >
        <Link to={paths.payments.getHref()}>
          <Logo width={32} height={32} />
        </Link>
      </IconButton>
    </header>
  )
}

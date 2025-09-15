import { HamburgerMenuIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons"
import { Box, IconButton } from "@radix-ui/themes"
import { Link } from "react-router-dom"
import { Logo } from "../../components/misc/Logo"
import { paths } from "../../config/paths"
import { useTheme } from "../../providers/theme/ThemeProvider"
import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick: () => void
}

const iconSize = { width: "22", height: "22" }

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <IconButton
        aria-label="Menu button"
        size="3"
        variant="ghost"
        onClick={onMenuClick}
      >
        <HamburgerMenuIcon {...iconSize} />
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
      <Box style={{ flexGrow: 1 }} />
      <ThemeToggle />
    </header>
  )
}

function ThemeToggle() {
  const { toggleTheme, theme } = useTheme()

  return (
    <IconButton
      aria-label="Theme toggle"
      size="3"
      variant="ghost"
      onClick={toggleTheme}
    >
      {theme === "light" ? (
        <SunIcon {...iconSize} />
      ) : (
        <MoonIcon {...iconSize} />
      )}
    </IconButton>
  )
}

import { HamburgerMenuIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons"
import { Box, IconButton } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Logo } from "../../components/misc/Logo"
import { useTheme } from "../../providers/theme/ThemeProvider"

import styles from "./Header.module.css"

interface HeaderProps {
  onMenuClick: () => void
}

const iconSize = { width: "22", height: "22" }

export function Header({ onMenuClick }: HeaderProps) {
  const { t } = useTranslation()

  return (
    <header className={styles.header}>
      <IconButton aria-label={t("header.menu")} size="3" variant="ghost" onClick={onMenuClick}>
        <HamburgerMenuIcon {...iconSize} />
      </IconButton>
      <IconButton asChild aria-label={t("header.logo")} size="3" radius="full" variant="ghost">
        <Link to="/payments">
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
  const { t } = useTranslation()

  return (
    <IconButton aria-label={t("header.themeToggle")} size="3" variant="ghost" onClick={toggleTheme}>
      {theme === "light" ? <SunIcon {...iconSize} /> : <MoonIcon {...iconSize} />}
    </IconButton>
  )
}

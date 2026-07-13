import { Cross1Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex, IconButton, Separator, Text } from "@radix-ui/themes"
import { Link, useNavigate } from "@tanstack/react-router"
import { useCallback, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { getSupabaseClient } from "../../lib/supabase"

import styles from "./Sidebar.module.css"

interface SidebarProps {
  children?: ReactNode
  open: boolean
  onClose: () => void
}

export function Sidebar({ children, open, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const supabase = getSupabaseClient()
  const { t } = useTranslation()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setLogoutFailed(false)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Failed to sign out from supabase:", error)
        setLogoutFailed(true)
        return
      }

      await navigate({ to: "/" })
      onClose()
    } catch (error) {
      console.error("Failed to sign out from supabase:", error)
      setLogoutFailed(true)
    } finally {
      setIsLoggingOut(false)
    }
  }, [isLoggingOut, navigate, onClose, supabase])

  return (
    <>
      {open ? (
        <div
          aria-hidden="true"
          className={styles.backdrop}
          data-testid="sidebar-backdrop"
          onClick={onClose}
        />
      ) : null}
      <aside data-open={open} className={styles.sidebar}>
        {/* Sidebar Header */}
        <Flex className={styles.sidebarHeader} p="4" justify="between" align="center" gap="4">
          <Link to="/" className={styles.link}>
            <Button className={styles.sidebarButton} variant="ghost" size="3">
              <Text size="3" weight="bold">
                {t("app.name")}
              </Text>
            </Button>
          </Link>
          <IconButton
            aria-label={t("common.close", { target: "sidebar" })}
            variant="ghost"
            onClick={onClose}
          >
            <Cross1Icon />
          </IconButton>
        </Flex>
        <Separator size="4" />
        {/* Sidebar Contents */}
        <Flex className={styles.sidebarContents} align="start" direction="column" gap="4" p="4">
          {children}
        </Flex>
        <Separator size="4" />
        {/* Sidebar Footer */}
        <Flex className={styles.sidebarFooter} direction="column" gap="3" p="4">
          {logoutFailed ? (
            <Callout.Root aria-live="polite" role="alert" color="red" variant="surface" size="1">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>{t("auth.logoutFailed")}</Callout.Text>
            </Callout.Root>
          ) : null}
          <Button
            color="gray"
            loading={isLoggingOut}
            variant="soft"
            onClick={() => void handleLogout()}
          >
            {t("auth.logout")}
          </Button>
        </Flex>
      </aside>
    </>
  )
}

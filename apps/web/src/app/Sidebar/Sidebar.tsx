import { Cross1Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex, IconButton, Separator, Text } from "@radix-ui/themes"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Logo } from "../../components/misc/Logo"
import { getSupabaseClient } from "../../lib/supabase"

import styles from "./Sidebar.module.css"

interface SidebarProps {
  children?: ReactNode
  id?: string
  open: boolean
  permanent?: boolean
  onClose: () => void
}

export function Sidebar({ children, id, open, permanent = false, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const supabase = getSupabaseClient()
  const { t } = useTranslation()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const drawerOpen = open && !permanent
  const collapsed = permanent && !open
  const drawerHidden = !permanent && !open

  useEffect(() => {
    if (!drawerOpen) return

    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [drawerOpen, onClose])

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setLogoutFailed(false)

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" })
      if (error) {
        console.error("Failed to sign out from supabase:", error)
        setLogoutFailed(true)
        return
      }

      queryClient.clear()
      await navigate({ to: "/" })
      onClose()
    } catch (error) {
      console.error("Failed to sign out from supabase:", error)
      setLogoutFailed(true)
    } finally {
      setIsLoggingOut(false)
    }
  }, [isLoggingOut, navigate, onClose, queryClient, supabase])

  return (
    <>
      {drawerOpen ? (
        <div
          aria-hidden="true"
          className={styles.backdrop}
          data-testid="sidebar-backdrop"
          onClick={onClose}
        />
      ) : null}
      <aside
        id={id}
        aria-hidden={drawerHidden || undefined}
        inert={drawerHidden}
        data-open={open}
        data-permanent={permanent}
        className={styles.sidebar}
      >
        <Flex className={styles.sidebarHeader} p="4" justify="between" align="center" gap="4">
          <Button asChild variant="ghost" size="3" color="gray">
            <Link to="/" aria-label={t("app.name")} onClick={onClose}>
              <Logo width={24} height={24} alt="" />
              {!collapsed && (
                <Text size="3" weight="bold">
                  {t("app.name")}
                </Text>
              )}
            </Link>
          </Button>
          {!permanent && (
            <IconButton
              ref={closeButton}
              aria-label={t("common.close", { target: "sidebar" })}
              variant="ghost"
              onClick={onClose}
            >
              <Cross1Icon />
            </IconButton>
          )}
        </Flex>
        {!permanent && <Separator size="4" />}
        <Flex asChild className={styles.sidebarContents} direction="column" gap="3" p="4">
          <nav aria-label={t("navigation.main")}>{children}</nav>
        </Flex>
        {!permanent && <Separator size="4" />}
        <Flex className={styles.sidebarFooter} direction="column" gap="3" p="4">
          {logoutFailed ? (
            <Callout.Root
              aria-live="polite"
              className={styles.logoutError}
              role="alert"
              color="red"
              variant="surface"
              size="1"
            >
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

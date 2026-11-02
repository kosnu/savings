import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Heading } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { paths } from "../../config/paths"
import { getSupabaseClient } from "../../lib/supabase"

interface SessionErrorProps {
  onRetry: () => void
  requiresSignIn?: boolean
}

export function SessionError({ onRetry, requiresSignIn = false }: SessionErrorProps) {
  const { t } = useTranslation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInFailed, setSignInFailed] = useState(false)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const signIn = async () => {
    if (isSigningIn) return

    setIsSigningIn(true)
    setSignInFailed(false)
    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${paths.auth.getHref()}` },
      })
      if (error) throw error
    } catch {
      setIsSigningIn(false)
      setSignInFailed(true)
    }
  }

  return (
    <main>
      <Container p="4" size="2">
        <Flex direction="column" gap="4" align="start">
          <Heading ref={headingRef} as="h1" size="6" tabIndex={-1}>
            {t("auth.sessionErrorTitle")}
          </Heading>
          <Callout.Root role="alert" color="red" variant="surface" size="1">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>
              {t(
                signInFailed
                  ? "auth.signInFailed"
                  : requiresSignIn
                    ? "auth.sessionSignInRequired"
                    : "auth.sessionErrorDescription",
              )}
            </Callout.Text>
          </Callout.Root>
          {requiresSignIn ? (
            <Button
              type="button"
              variant="outline"
              loading={isSigningIn}
              onClick={() => void signIn()}
            >
              {t("auth.continueWithGoogle")}
            </Button>
          ) : (
            <Button type="button" variant="soft" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )}
        </Flex>
      </Container>
    </main>
  )
}

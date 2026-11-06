import { Button, Container, Flex, Heading, Link, Text } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export function AccountActionCallback({
  completion,
}: {
  completion: Promise<"retry" | "reactivate">
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<"loading" | "error" | "retry" | "reactivate">("loading")
  useEffect(() => {
    let active = true
    void completion.then(
      (result) => {
        if (active) setState(result)
      },
      () => {
        if (active) setState("error")
      },
    )
    return () => {
      active = false
    }
  }, [completion])
  return (
    <main>
      <Container size="2" p="4">
        <Flex direction="column" gap="4">
          <Heading as="h1" size="6">
            {t("deletion.actionTitle")}
          </Heading>
          <Text as="p" role={state === "error" ? "alert" : "status"}>
            {t(`deletion.action.${state}`)}
          </Text>
          {state === "retry" && (
            <Button asChild>
              <a href="/settings/profile">{t("deletion.returnToConfirm")}</a>
            </Button>
          )}
          {state === "reactivate" && (
            <Button asChild>
              <a href="/">{t("deletion.continue")}</a>
            </Button>
          )}
          {state === "error" && (
            <>
              <Link href="/settings/profile">{t("deletion.returnToProfile")}</Link>
              <Link href="/account-deletion">{t("deletion.resultLink")}</Link>
            </>
          )}
        </Flex>
      </Container>
    </main>
  )
}

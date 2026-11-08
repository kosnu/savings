import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Spinner } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { useDeletionHandoff, type DeletionHandoffOptions } from "../useDeletionHandoff"

export function DeletionHandoff(props: DeletionHandoffOptions) {
  const { t } = useTranslation()
  const { failure } = useDeletionHandoff(props)

  return (
    <main>
      <Container size="1" p="4">
        <Flex direction="column" align="center" gap="3">
          {failure ? (
            <>
              <Callout.Root role="alert" color="red" variant="surface" size="1">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>{t(failure.message)}</Callout.Text>
              </Callout.Root>
              <Button variant="soft" onClick={failure.retry}>
                {t(failure.label)}
              </Button>
            </>
          ) : (
            <output aria-label={t("common.loading")}>
              <Spinner />
            </output>
          )}
        </Flex>
      </Container>
    </main>
  )
}

import { Box, Button, Container, Flex, Grid, Heading, Section, Separator } from "@radix-ui/themes"
import { Link, Outlet } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import styles from "./SettingsPage.module.css"

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <Container size="4">
      <Flex direction="column" gap="4">
        <Heading as="h1" size="6">
          <Link to="/settings" className={styles.headingLink}>
            {t("settings.title")}
          </Link>
        </Heading>
        <Grid
          columns={{ initial: "1", sm: "minmax(160px, 220px) auto minmax(0, 1fr)" }}
          gap="4"
          align="stretch"
          minHeight="calc(100vh - 9rem)"
        >
          <nav aria-label={t("settings.sections")}>
            <Flex direction="column" gap="2" align="stretch">
              <Button asChild variant="ghost" size="3">
                <Link to="/settings/book" className={styles.menuLink}>
                  {t("navigation.book")}
                </Link>
              </Button>
            </Flex>
          </nav>
          <Box display={{ initial: "none", sm: "block" }}>
            <Separator decorative orientation="vertical" size="4" />
          </Box>
          <Section size="1" minWidth="0">
            <Outlet />
          </Section>
        </Grid>
      </Flex>
    </Container>
  )
}

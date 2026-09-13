import {
  ArrowRightIcon,
  BarChartIcon,
  CheckIcon,
  Pencil1Icon,
  TargetIcon,
} from "@radix-ui/react-icons"
import { Box, Button, Container, Flex, Grid, Heading, Separator, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BudgetProgress } from "../../../features/budgets"
import { toCurrency } from "../../../utils/toCurrency"

import styles from "./TopPage.module.css"

const exampleBudget = 100000
const exampleSpending = 68000

export function TopPage() {
  const { t } = useTranslation()
  const remaining = t("common.left", { amount: toCurrency(exampleBudget - exampleSpending) })

  return (
    <main className={styles.page}>
      <Container size="4" px={{ initial: "4", sm: "6" }}>
        <Flex asChild align="center" justify="between" gap="4" py="5">
          <header>
            <Flex align="center" gap="2">
              <img src="/icon.svg" alt="" width="32" height="32" />
              <Text size="4" weight="bold">
                {t("app.name")}
              </Text>
            </Flex>
            <Button asChild variant="ghost" size="2">
              <Link to="/auth">
                {t("auth.login")}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </header>
        </Flex>

        <Grid
          columns={{ initial: "1", md: "2" }}
          gap={{ initial: "7", md: "8" }}
          align="center"
          py={{ initial: "6", md: "9" }}
        >
          <Flex direction="column" align="start" gap="5" className={styles.heroCopy}>
            <Text as="p" size="2" weight="medium" color="violet">
              {t("introduction.eyebrow")}
            </Text>
            <Heading as="h1" size={{ initial: "7", sm: "8" }} className={styles.headline}>
              {t("introduction.title")}
              <br />
              <span className={styles.accent}>{t("introduction.titleAccent")}</span>
            </Heading>
            <Text as="p" size="3" className={styles.description}>
              {t("introduction.description", { appName: t("app.name") })}
            </Text>
            <Flex direction="column" align="start" gap="3" pt="2">
              <Button asChild size="3">
                <Link to="/auth">
                  {t("introduction.start", { appName: t("app.name") })}
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Text as="p" size="2" color="gray">
                {t("introduction.startNote")}
              </Text>
            </Flex>
          </Flex>

          <Box className={styles.previewStage} p={{ initial: "3", sm: "5" }}>
            <figure className={styles.figure}>
              <Flex
                direction="column"
                className={styles.preview}
                p={{ initial: "4", sm: "5" }}
                gap="5"
              >
                <Flex align="center" justify="between" gap="3">
                  <Text size="2" weight="bold">
                    {t("app.name")}
                  </Text>
                  <Text size="1" color="gray">
                    {t("introduction.example.preview")}
                  </Text>
                </Flex>
                <Flex direction="column" gap="2">
                  <Text as="p" size="2" color="gray">
                    {t("introduction.example.available")}
                  </Text>
                  <Text
                    as="p"
                    size={{ initial: "7", sm: "8" }}
                    weight="bold"
                    color="green"
                    className={styles.amount}
                  >
                    {remaining}
                  </Text>
                  <BudgetProgress
                    amount={exampleSpending}
                    budget={exampleBudget}
                    status="remaining"
                    ariaLabel={t("summary.monthlyBudgetProgress")}
                    ariaValueText={t("summary.budgetProgressValue", {
                      amount: toCurrency(exampleSpending),
                      budget: toCurrency(exampleBudget),
                      difference: remaining,
                    })}
                  />
                </Flex>
                <Grid asChild columns="2" gap="3">
                  <dl className={styles.budgetDetails}>
                    <div>
                      <Text asChild size="1" color="gray">
                        <dt>{t("introduction.example.budget")}</dt>
                      </Text>
                      <Text asChild size="3" weight="medium">
                        <dd>{toCurrency(exampleBudget)}</dd>
                      </Text>
                    </div>
                    <div>
                      <Text asChild size="1" color="gray">
                        <dt>{t("payments.total.label")}</dt>
                      </Text>
                      <Text asChild size="3" weight="medium">
                        <dd>{toCurrency(exampleSpending)}</dd>
                      </Text>
                    </div>
                  </dl>
                </Grid>
                <Separator size="4" />
                <Flex direction="column" gap="3">
                  <Text as="p" size="2" weight="medium">
                    {t("introduction.example.categories")}
                  </Text>
                  <Flex asChild direction="column" gap="3">
                    <ul className={styles.categories}>
                      <li>
                        <span>{t("introduction.example.food")}</span>
                        <span>{toCurrency(32000)}</span>
                      </li>
                      <li>
                        <span>{t("introduction.example.shopping")}</span>
                        <span>{toCurrency(22000)}</span>
                      </li>
                      <li>
                        <span>{t("introduction.example.other")}</span>
                        <span>{toCurrency(14000)}</span>
                      </li>
                    </ul>
                  </Flex>
                </Flex>
              </Flex>
              <Text asChild align="center" size="1" color="gray">
                <figcaption className={styles.caption}>
                  {t("introduction.example.caption")}
                </figcaption>
              </Text>
            </figure>
            <Flex gap="2" align="start" pt="4" px="1">
              <CheckIcon aria-hidden="true" className={styles.previewCheck} />
              <Text as="p" size="2" color="violet">
                {t("introduction.example.takeaway")}
              </Text>
            </Flex>
          </Box>
        </Grid>

        <Box asChild py={{ initial: "7", md: "9" }} className={styles.everyday}>
          <section aria-labelledby="everyday-heading">
            <Flex direction="column" gap="3" mb="7">
              <Text as="p" size="2" weight="medium" color="violet">
                {t("introduction.everyday.eyebrow")}
              </Text>
              <Heading
                as="h2"
                id="everyday-heading"
                size={{ initial: "6", sm: "7" }}
                className={styles.sectionHeading}
              >
                {t("introduction.everyday.title")}
              </Heading>
              <Text as="p" size="3" color="gray">
                {t("introduction.everyday.description")}
              </Text>
            </Flex>
            <Grid asChild columns={{ initial: "1", sm: "3" }} gap={{ initial: "6", sm: "7" }}>
              <ol className={styles.steps}>
                <li>
                  <Flex align="center" gap="3" mb="4" className={styles.stepLabel}>
                    <TargetIcon aria-hidden="true" />
                    <Text size="2">01</Text>
                  </Flex>
                  <Heading as="h3" size="4" mb="3">
                    {t("introduction.everyday.budgetTitle")}
                  </Heading>
                  <Text as="p" size="3" color="gray">
                    {t("introduction.example.description")}
                  </Text>
                </li>
                <li>
                  <Flex align="center" gap="3" mb="4" className={styles.stepLabel}>
                    <Pencil1Icon aria-hidden="true" />
                    <Text size="2">02</Text>
                  </Flex>
                  <Heading as="h3" size="4" mb="3">
                    {t("introduction.everyday.recordTitle")}
                  </Heading>
                  <Text as="p" size="3" color="gray">
                    {t("introduction.everyday.record")}
                  </Text>
                </li>
                <li>
                  <Flex align="center" gap="3" mb="4" className={styles.stepLabel}>
                    <BarChartIcon aria-hidden="true" />
                    <Text size="2">03</Text>
                  </Flex>
                  <Heading as="h3" size="4" mb="3">
                    {t("introduction.everyday.reviewTitle")}
                  </Heading>
                  <Text as="p" size="3" color="gray">
                    {t("introduction.everyday.review")}
                  </Text>
                </li>
              </ol>
            </Grid>
          </section>
        </Box>

        <Flex
          asChild
          direction={{ initial: "column", sm: "row" }}
          align={{ initial: "start", sm: "center" }}
          justify="between"
          gap="5"
          py="7"
          mb="7"
          className={styles.closing}
        >
          <section aria-labelledby="start-heading">
            <Flex direction="column" gap="3">
              <Heading as="h2" id="start-heading" size="5">
                {t("introduction.closingTitle")}
              </Heading>
              <Text as="p" size="2" color="gray">
                {t("introduction.firstStep")}
              </Text>
            </Flex>
            <Button asChild size="3" className={styles.closingAction}>
              <Link to="/auth">
                {t("introduction.start", { appName: t("app.name") })}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </section>
        </Flex>
        <Box pb="5">
          <Text as="p" size="1" color="gray">
            {t("app.name")}
          </Text>
        </Box>
      </Container>
    </main>
  )
}

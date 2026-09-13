import { Button, Container, DataList, Flex, Heading, Separator, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BudgetProgress } from "../../../features/budgets"
import { toCurrency } from "../../../utils/toCurrency"

const exampleBudget = 100000
const exampleSpending = 68000

export function TopPage() {
  const { t } = useTranslation()
  const remaining = t("common.left", { amount: toCurrency(exampleBudget - exampleSpending) })

  return (
    <main>
      <Container p="4" size="2">
        <Flex direction="column" gap="4">
          <Heading as="h1" size="6">
            {t("app.name")}
          </Heading>
          <Flex direction="column" gap="3" asChild>
            <section aria-labelledby="introduction-heading">
              <Heading as="h2" id="introduction-heading" size="4" weight="medium">
                {t("introduction.title")}
              </Heading>
              <Text as="p" size="3">
                {t("introduction.description", { appName: t("app.name") })}
              </Text>
              <Flex>
                <Button asChild>
                  <Link to="/auth">{t("introduction.start", { appName: t("app.name") })}</Link>
                </Button>
              </Flex>
            </section>
          </Flex>
          <Separator size="4" />
          <Flex direction="column" gap="3" asChild>
            <section aria-labelledby="example-heading">
              <Heading as="h2" id="example-heading" size="4" weight="medium">
                {t("introduction.example.title")}
              </Heading>
              <Text as="p" color="gray" size="2">
                {t("introduction.example.caption")}
              </Text>
              <DataList.Root>
                <DataList.Item>
                  <DataList.Label>{t("introduction.example.budget")}</DataList.Label>
                  <DataList.Value>{toCurrency(exampleBudget)}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>{t("payments.total.label")}</DataList.Label>
                  <DataList.Value>{toCurrency(exampleSpending)}</DataList.Value>
                </DataList.Item>
              </DataList.Root>
              <Flex direction="column" gap="2">
                <Text as="p" color="green" size="5" weight="bold">
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
              <Text as="p" size="3">
                {t("introduction.example.description")}
              </Text>
            </section>
          </Flex>
          <Separator size="4" />
          <Flex direction="column" gap="3" asChild>
            <section aria-labelledby="everyday-heading">
              <Heading as="h2" id="everyday-heading" size="4" weight="medium">
                {t("introduction.everyday.title")}
              </Heading>
              <Text as="p" size="3">
                {t("introduction.everyday.record")}
              </Text>
              <Text as="p" size="3">
                {t("introduction.everyday.review")}
              </Text>
            </section>
          </Flex>
          <Text as="p" color="gray" size="2">
            {t("introduction.firstStep")}
          </Text>
        </Flex>
      </Container>
    </main>
  )
}

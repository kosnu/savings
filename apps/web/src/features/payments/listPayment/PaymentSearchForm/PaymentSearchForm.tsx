import { Box, Flex, Grid, Text } from "@radix-ui/themes"
import { useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { MonthPicker } from "../../../../components/inputs/MonthPicker"
import { useDateRange } from "../../../../utils/useDateRange"
import { PaymentCategoryFilter } from "../PaymentCategoryFilter"

import styles from "./PaymentSearchForm.module.css"

export function PaymentSearchForm() {
  const { t } = useTranslation()
  const { date } = useDateRange()
  const navigate = useNavigate({ from: "/payments" })
  const categoryId = useId()

  const handleMonthChange = (nextDate: Date | undefined) => {
    if (!nextDate) return

    void navigate({
      to: "/payments",
      search: (prev) => ({
        ...prev,
        year: String(nextDate.getFullYear()),
        month: String(nextDate.getMonth() + 1),
      }),
    })
  }

  return (
    <search aria-label={t("payments.search.title")}>
      <Grid columns={{ initial: "1", sm: "auto minmax(0, 1fr)" }} gap="3">
        <Box asChild minWidth="0" m="0" p="0">
          <fieldset className={styles.monthField}>
            <Text asChild size="2" weight="bold" mb="1">
              <legend className={styles.monthLabel}>{t("payments.search.month")}</legend>
            </Text>
            <MonthPicker size="2" value={date} onChange={handleMonthChange} />
          </fieldset>
        </Box>
        <Flex direction="column" gap="1" minWidth="0">
          <Text as="label" size="2" weight="bold" htmlFor={categoryId}>
            {t("payments.category.label")}
          </Text>
          <PaymentCategoryFilter id={categoryId} />
        </Flex>
      </Grid>
    </search>
  )
}

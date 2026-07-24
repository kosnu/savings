import { Checkbox, Flex, Text, TextField } from "@radix-ui/themes"
import type { StandardSchemaV1Issue } from "@tanstack/react-form"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { getErrorMessages } from "../../../../utils/getErrorMessages"

interface CategoryFormFieldsProps {
  name: string
  nameErrors: (StandardSchemaV1Issue | undefined)[]
  budgetAmount: string | number | undefined
  budgetErrors: (StandardSchemaV1Issue | undefined)[]
  pinned: boolean
  disabled: boolean
  onNameChange: (name: string) => void
  onBudgetAmountChange: (budgetAmount: string | number | undefined) => void
  onPinnedChange: (pinned: boolean) => void
}

export function CategoryFormFields({
  name,
  nameErrors,
  budgetAmount,
  budgetErrors,
  pinned,
  disabled,
  onNameChange,
  onBudgetAmountChange,
  onPinnedChange,
}: CategoryFormFieldsProps) {
  const nameInputId = useId()
  const nameErrorId = useId()
  const budgetInputId = useId()
  const budgetMessagesId = useId()
  const pinnedInputId = useId()
  const { t } = useTranslation()
  const nameErrorMessages = getErrorMessages(nameErrors) ?? []
  const hasNameError = nameErrorMessages.length > 0
  const budgetErrorMessages = getErrorMessages(budgetErrors) ?? []
  const hasBudgetError = budgetErrorMessages.length > 0
  const budgetMessages = hasBudgetError ? budgetErrorMessages : [t("categories.budgetHelp")]

  return (
    <Flex direction="column" gap="3">
      <BaseField>
        <FieldLabel htmlFor={nameInputId} required>
          {t("categories.name")}
        </FieldLabel>
        <TextField.Root
          autoFocus
          disabled={disabled}
          id={nameInputId}
          name="name"
          value={name}
          aria-label={t("categories.name")}
          aria-describedby={hasNameError ? nameErrorId : undefined}
          aria-invalid={hasNameError}
          onChange={(event) => {
            onNameChange(event.target.value)
          }}
        />
        <span id={nameErrorId}>
          <FieldMessages error={hasNameError} messages={nameErrorMessages} />
        </span>
      </BaseField>
      <BaseField>
        <FieldLabel htmlFor={budgetInputId}>{t("categories.budget")}</FieldLabel>
        <AmountInput
          disabled={disabled}
          id={budgetInputId}
          name="budgetAmount"
          value={budgetAmount === undefined ? "" : String(budgetAmount)}
          aria-label={t("categories.budget")}
          aria-describedby={budgetMessagesId}
          aria-invalid={hasBudgetError}
          onChange={onBudgetAmountChange}
        />
        <span id={budgetMessagesId}>
          <FieldMessages error={hasBudgetError} messages={budgetMessages} />
        </span>
      </BaseField>
      <Text as="label" size="2" htmlFor={pinnedInputId}>
        <Flex gap="2" align="center">
          <Checkbox
            id={pinnedInputId}
            name="pinned"
            checked={pinned}
            disabled={disabled}
            onCheckedChange={(nextChecked) => {
              onPinnedChange(nextChecked === true)
            }}
          />
          {t("categories.pinCategory")}
        </Flex>
      </Text>
    </Flex>
  )
}

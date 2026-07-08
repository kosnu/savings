import { screen, type TestUser } from "../../../../test/test-utils"

type RoleQueryScope = Pick<typeof screen, "findByRole" | "getByRole">

interface BudgetCreationFormOperationOptions {
  user: TestUser
  fieldScope?: RoleQueryScope
  optionScope?: RoleQueryScope
}

interface SelectBudgetMonthOptions extends BudgetCreationFormOperationOptions {
  year: string
  month: string
}

interface TypeBudgetAmountOptions extends BudgetCreationFormOperationOptions {
  amount: string
}

interface FillCreateMonthlyBudgetFormOptions extends SelectBudgetMonthOptions {
  amount: string
}

export async function selectBudgetMonth({
  user,
  year,
  month,
  fieldScope = screen,
  optionScope = screen,
}: SelectBudgetMonthOptions) {
  await user.click(fieldScope.getByRole("combobox", { name: "Year" }))
  await user.click(await optionScope.findByRole("option", { name: year }))

  await user.click(fieldScope.getByRole("combobox", { name: "Month" }))
  await user.click(await optionScope.findByRole("option", { name: getMonthOptionName(month) }))
}

export async function typeBudgetAmount({
  user,
  amount,
  fieldScope = screen,
}: TypeBudgetAmountOptions) {
  await user.type(fieldScope.getByRole("textbox", { name: /amount/i }), amount)
}

export async function fillCreateMonthlyBudgetForm({
  user,
  year,
  month,
  amount,
  fieldScope,
  optionScope,
}: FillCreateMonthlyBudgetFormOptions) {
  await selectBudgetMonth({ user, year, month, fieldScope, optionScope })
  await typeBudgetAmount({ user, amount, fieldScope })
}

function getMonthOptionName(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2025, Number(month) - 1, 1),
  )
}

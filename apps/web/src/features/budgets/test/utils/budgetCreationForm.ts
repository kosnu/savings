import { screen, waitFor, within, type TestUser } from "../../../../test/test-utils"

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

interface SelectBudgetCategoryOptions extends BudgetCreationFormOperationOptions {
  name: string
}

interface TypeBudgetAmountOptions extends BudgetCreationFormOperationOptions {
  amount: string
}

interface FillCreateMonthlyBudgetFormOptions extends SelectBudgetMonthOptions {
  amount: string
}

interface FillCreateCategoryBudgetFormOptions extends SelectBudgetMonthOptions {
  categoryName: string
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
  await user.click(await optionScope.findByRole("option", { name: month }))
}

export async function selectBudgetCategory({
  user,
  name,
  fieldScope = screen,
  optionScope = screen,
}: SelectBudgetCategoryOptions) {
  await user.click(await fieldScope.findByRole("combobox", { name: /category/i }))
  const listbox = await optionScope.findByRole("listbox")

  await waitFor(() => {
    if (within(listbox).queryByRole("option", { name: /loading/i }) !== null) {
      throw new Error("Category options are still loading.")
    }
  })

  await user.click(await within(listbox).findByRole("option", { name }))
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

export async function fillCreateCategoryBudgetForm({
  user,
  categoryName,
  year,
  month,
  amount,
  fieldScope,
  optionScope,
}: FillCreateCategoryBudgetFormOptions) {
  await selectBudgetCategory({ user, name: categoryName, fieldScope, optionScope })
  await selectBudgetMonth({ user, year, month, fieldScope, optionScope })
  await typeBudgetAmount({ user, amount, fieldScope })
}

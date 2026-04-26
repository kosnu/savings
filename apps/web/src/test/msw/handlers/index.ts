import { authHandlers } from "./auth"
import { categoryHandlers } from "./categories"
import { categoryBudgetHandlers } from "./categoryBudgets"
import { monthlyBudgetHandlers } from "./monthlyBudgets"
import { paymentHandlers } from "./payments"

export const handlers = [
  ...authHandlers,
  ...paymentHandlers,
  ...categoryHandlers,
  ...categoryBudgetHandlers,
  ...monthlyBudgetHandlers,
]

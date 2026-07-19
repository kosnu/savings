import { authHandlers } from "./auth"
import { categoryHandlers } from "./categories"
import { monthlyBudgetHandlers } from "./monthlyBudgets"
import { paymentHandlers } from "./payments"
import { profileHandlers } from "./profile"

export const handlers = [
  ...authHandlers,
  ...paymentHandlers,
  ...categoryHandlers,
  ...monthlyBudgetHandlers,
  ...profileHandlers,
]

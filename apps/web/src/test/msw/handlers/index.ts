import { authHandlers } from "./auth"
import { bookHandlers } from "./books"
import { categoryHandlers } from "./categories"
import { monthlyBudgetHandlers } from "./monthlyBudgets"
import { paymentHandlers } from "./payments"
import { profileHandlers } from "./profile"

export const handlers = [
  ...authHandlers,
  ...bookHandlers,
  ...paymentHandlers,
  ...categoryHandlers,
  ...monthlyBudgetHandlers,
  ...profileHandlers,
]

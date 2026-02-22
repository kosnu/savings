import { authHandlers } from "./auth"
import { categoryHandlers } from "./categories"
import { paymentHandlers } from "./payments"

export const handlers = [...authHandlers, ...paymentHandlers, ...categoryHandlers]

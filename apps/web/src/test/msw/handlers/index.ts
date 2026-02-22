import { categoryHandlers } from "./categories"
import { paymentHandlers } from "./payments"

export const handlers = [...paymentHandlers, ...categoryHandlers]

export * from "./CategoryTotals"

import { Card } from "@radix-ui/themes"
import { toCurrency } from "../../../utils/toCurrency"
import { useCategories } from "../../categories/listCategory/useCategories"
import { usePayments } from "../../payments/listPayment/usePayments"
import { mapPaymentsToCategory } from "./mapPaymentsToCategory"

console.log(Card, toCurrency, useCategories, usePayments, mapPaymentsToCategory)

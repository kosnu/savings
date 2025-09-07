import { useCategories } from "../../categories/listCategory/useCategories"
import { usePayments } from "../../payments/listPayment/usePayments"
import { mapPaymentsToCategory } from "./mapPaymentsToCategory"

interface UseCategoryTotalsReturn {
  categoryTotals: Record<string, number>
}

function useCategoryTotals(): UseCategoryTotalsReturn {
  const { data: payments } = usePayments()
  const { data: categories } = useCategories()

  const categoryTotals = mapPaymentsToCategory(payments, categories)

  return { categoryTotals }
}

export { useCategoryTotals }

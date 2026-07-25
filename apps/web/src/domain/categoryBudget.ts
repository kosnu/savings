import * as z from "zod"

const effectiveCategoryBudgetSchema = z
  .object({
    category_id: z.number(),
    status: z.enum(["amount", "none"]),
    amount: z.number().nullable(),
  })
  .refine(
    (value) =>
      (value.status === "amount" && value.amount !== null) ||
      (value.status === "none" && value.amount === null),
  )

export interface CategoryBudgetState {
  status: "amount" | "none" | "unset"
  amount: number | null
}

export function toCategoryBudgetMap(value: unknown): Map<number, CategoryBudgetState> {
  const result = z.array(effectiveCategoryBudgetSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category budget response")
  }

  return new Map(
    result.data.map((budget) => [
      budget.category_id,
      {
        status: budget.status,
        amount: budget.status === "amount" ? budget.amount : null,
      },
    ]),
  )
}

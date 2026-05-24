export const summaryQueryKeys = {
  totalExpendituresAll: ["totalExpenditures"],
  totalExpenditures: (month: string) => ["totalExpenditures", month] as const,
  categoryTotalsAll: ["categoryTotals"],
  categoryTotals: (cacheScope: string, month: string) =>
    ["categoryTotals", cacheScope, month] as const,
} as const

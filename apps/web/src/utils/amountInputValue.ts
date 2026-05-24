const DECIMAL_NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/

export function normalizeAmountInputValue(value: unknown): unknown {
  if (typeof value !== "string") return value

  const trimmedValue = value.trim()
  if (trimmedValue === "") return undefined

  if (!DECIMAL_NUMBER_PATTERN.test(trimmedValue)) return trimmedValue

  const numericValue = Number(trimmedValue)

  if (Number.isNaN(numericValue)) return trimmedValue

  return numericValue
}

export function toAmountInputValue(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined

  return String(value)
}

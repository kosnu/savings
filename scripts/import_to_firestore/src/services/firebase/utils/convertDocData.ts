export function convertDocData(value: object) {
  // deno-lint-ignore no-explicit-any
  const result: any = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") {
      result[key] = { stringValue: val }
    } else if (typeof val === "number") {
      result[key] = { integerValue: val }
    } else if (val instanceof Date) {
      result[key] = { timestampValue: val.toISOString() }
    }
  }
  return result
}

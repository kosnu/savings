export function toCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "JPY",
  })
}

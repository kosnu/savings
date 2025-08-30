export function parsePrice(str: string): number {
  return Number.parseInt(str.replace(/[¥,]/g, ""), 10)
}

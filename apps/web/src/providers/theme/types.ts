export type TTheme = "light" | "dark"

export function isTheme(value: unknown): value is TTheme {
  return value === "light" || value === "dark"
}

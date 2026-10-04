export type TTheme = "light" | "dark"
export type TThemePreference = TTheme | "system"

export function isTheme(value: unknown): value is TTheme {
  return value === "light" || value === "dark"
}

export function isThemePreference(value: unknown): value is TThemePreference {
  return value === "system" || isTheme(value)
}

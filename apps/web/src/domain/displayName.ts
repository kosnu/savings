import * as z from "zod"

export const DISPLAY_NAME_MAX_LENGTH = 64

export const displayNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Display name cannot be empty")
  .refine(
    (value) => Array.from(value).length <= DISPLAY_NAME_MAX_LENGTH,
    `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less`,
  )

interface InitialDisplayNameSource {
  name?: unknown
  fullName?: unknown
  email?: string | null
}

export function toInitialDisplayName({ name, fullName, email }: InitialDisplayNameSource): string {
  const normalizedEmail = toNonEmptyString(email)
  const emailLocalPart = toNonEmptyString(normalizedEmail?.split("@", 1)[0])
  const source =
    [toNonEmptyString(name), toNonEmptyString(fullName), emailLocalPart].find(
      (value): value is string => value !== undefined,
    ) ?? "User"

  return Array.from(source).slice(0, DISPLAY_NAME_MAX_LENGTH).join("")
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmedValue = value.trim()

  return trimmedValue === "" ? undefined : trimmedValue
}

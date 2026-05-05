import type { StandardSchemaV1Issue } from "@tanstack/react-form"

export function getErrorMessages(
  errors: (StandardSchemaV1Issue | undefined)[],
): string[] | undefined {
  const messages = errors.map((e) => e?.message).filter((m): m is string => typeof m === "string")

  return messages.length > 0 ? messages : undefined
}

import type { ZodError } from "zod/v4"

export function findZodError<Schema>(
  error: ZodError<Schema> | undefined,
  key: keyof Schema,
) {
  return error?.issues.find((issue) => issue.path[0] === key)
}

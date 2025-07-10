import * as z from "zod";


export function findZodError<Schema>(
  error: z.ZodError<Schema> | undefined,
  key: keyof Schema,
) {
  return error?.issues.find((issue) => issue.path[0] === key)
}

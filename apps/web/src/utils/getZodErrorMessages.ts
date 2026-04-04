import { z, type ZodError } from "zod"

export function getZodErrorMessages<Schema>(error: ZodError<Schema>): string[] | undefined {
  const { formErrors, fieldErrors } = z.flattenError(error)
  const messages = [
    ...formErrors,
    ...Object.values<(typeof fieldErrors)[keyof typeof fieldErrors]>(fieldErrors).flat(),
  ].filter((message): message is string => typeof message === "string" && message.length > 0)

  return messages.length > 0 ? messages : undefined
}

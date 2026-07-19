import * as z from "zod"

export const DISPLAY_NAME_MAX_LENGTH = 64

export const profileResponseSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

export const displayNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Display name cannot be empty")
  .refine(
    (value) => Array.from(value).length <= DISPLAY_NAME_MAX_LENGTH,
    `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less`,
  )

export type Profile = z.infer<typeof profileResponseSchema>

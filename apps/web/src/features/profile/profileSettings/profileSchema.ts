import * as z from "zod"

export const profileResponseSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

export const displayNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Display name cannot be empty")

export type Profile = z.infer<typeof profileResponseSchema>

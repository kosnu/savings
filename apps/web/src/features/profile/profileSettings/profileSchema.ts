import * as z from "zod"

export const profileResponseSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  language: z.enum(["en", "ja"]).nullable().default(null),
})

export type Profile = z.infer<typeof profileResponseSchema>

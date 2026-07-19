import * as z from "zod"

export const profileResponseSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

export type Profile = z.infer<typeof profileResponseSchema>

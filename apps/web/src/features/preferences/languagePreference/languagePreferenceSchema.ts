import * as z from "zod"

import { appLanguages } from "../../../i18n"

export const languageSchema = z.enum(appLanguages)

export const languagePreferenceResponseSchema = z.object({
  language: languageSchema.nullable(),
})

export const languagePreferenceUpdateResponseSchema = z.object({
  auth_user_id: z.string(),
  language: languageSchema,
})

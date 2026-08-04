import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

const USERS_REST_URL = "*/rest/v1/users*"

export interface ProfileResponse {
  name: string
  email: string
  language?: "en" | "ja" | null
}

interface ProfileGetOptions {
  response?: ProfileResponse
  error?: boolean
  errorOnce?: boolean
  errorAfterUpdate?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface ProfileUpdateOptions {
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

const profileBodySchema = z.union([
  z.object({ name: z.string() }),
  z.object({ language: z.enum(["en", "ja"]) }),
])

export function createProfileHandlers({
  get = {},
  update = {},
}: {
  get?: ProfileGetOptions
  update?: ProfileUpdateOptions
} = {}) {
  let profile: ProfileResponse = get.response ?? {
    name: "Test User",
    email: "test@example.com",
    language: null,
  }
  let hasErrored = false
  let hasUpdated = false

  return [
    http.get(USERS_REST_URL, async () => {
      await delay(get.durationOrMode)

      if (get.error || (get.errorOnce && !hasErrored) || (get.errorAfterUpdate && hasUpdated)) {
        hasErrored = true
        return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
      }

      return HttpResponse.json(profile)
    }),
    http.patch(USERS_REST_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(update.errorResponse ?? { message: "Failed to update profile." }, {
          status: 500,
        })
      }

      const body = profileBodySchema.parse(await request.json())
      profile =
        "name" in body ? { ...profile, name: body.name } : { ...profile, language: body.language }
      hasUpdated = true

      return HttpResponse.json({
        auth_user_id: "mock-user-id",
        language: profile.language ?? null,
      })
    }),
  ]
}

export const profileHandlers = createProfileHandlers()

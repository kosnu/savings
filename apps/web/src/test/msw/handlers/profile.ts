import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

const USERS_REST_URL = "*/rest/v1/users*"

export interface ProfileResponse {
  name: string
  email: string
}

interface ProfileGetOptions {
  response?: ProfileResponse
  error?: boolean
  errorOnce?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface ProfileUpdateOptions {
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

const profileBodySchema = z.object({ name: z.string() })

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
  }
  let hasErrored = false

  return [
    http.get(USERS_REST_URL, async () => {
      await delay(get.durationOrMode)

      if (get.error || (get.errorOnce && !hasErrored)) {
        hasErrored = true
        return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
      }

      return HttpResponse.json(profile)
    }),
    http.patch(USERS_REST_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(
          update.errorResponse ?? { message: "Failed to save display name." },
          { status: 500 },
        )
      }

      const body = profileBodySchema.parse(await request.json())
      profile = { ...profile, name: body.name }

      return HttpResponse.json({ auth_user_id: "mock-user-id" })
    }),
  ]
}

export const profileHandlers = createProfileHandlers()

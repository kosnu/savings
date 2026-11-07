import type { Session } from "@supabase/supabase-js"

import { toInitialDisplayName } from "../../domain/displayName"
import { i18next } from "../../i18n"
import { loadAccountLanguage, resolveAccountLanguage } from "../../i18n/accountLanguage"
import { getMyDeletionState } from "../../lib/accountDeletion"
import { captureSupabaseSessionError } from "../../lib/sentry"
import { getSupabaseClient } from "../../lib/supabase"
import { ensureAuthenticatedUser } from "./ensureAuthenticatedUser"

export async function verifyAuthenticatedSession(session: Session, isCurrent: () => boolean) {
  const { error: getUserError } = await getSupabaseClient().auth.getUser()
  if (getUserError) throw getUserError
  if (!isCurrent()) return null

  const deletion = await getMyDeletionState(session.access_token)
  if (!isCurrent()) return null
  if (deletion.status === "pending") return { deletion }

  await ensureAuthenticatedUser(
    toInitialDisplayName({
      name: session.user.user_metadata.name,
      fullName: session.user.user_metadata.full_name,
      email: session.user.email,
    }),
  )

  const deviceLanguage = i18next.resolvedLanguage
  try {
    const accountLanguage = await loadAccountLanguage(session.user.id)
    return { language: resolveAccountLanguage(accountLanguage, deviceLanguage) }
  } catch (error) {
    captureSupabaseSessionError(error)
    return { language: resolveAccountLanguage(undefined, deviceLanguage) }
  }
}

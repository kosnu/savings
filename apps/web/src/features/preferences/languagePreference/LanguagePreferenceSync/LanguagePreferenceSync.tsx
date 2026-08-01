import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { useLanguagePreference } from "../useLanguagePreference"

export function LanguagePreferenceSync() {
  const { status, session } = useSupabaseSession()
  const { i18n, t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const lastReportedError = useRef<Error | null>(null)
  const authUserId = status === "authenticated" ? (session?.user.id ?? null) : null
  const { language, error } = useLanguagePreference(authUserId)

  useEffect(() => {
    if (language === undefined || language === null) return
    void i18n.changeLanguage(language)
  }, [i18n, language])

  useEffect(() => {
    if (!error || lastReportedError.current === error) return
    lastReportedError.current = error
    openSnackbar("error", t("language.loadError"))
  }, [error, openSnackbar, t])

  return null
}

import { useRef, useState } from "react"

import { prepareAccountDeletion, type DeletionPreview } from "../../../lib/accountDeletion"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"

export function useDeleteAccount() {
  const auth = useSupabaseSession()
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const loadAttempt = useRef(0)
  const isPreparing = busy && preview === null
  const isSubmitting = busy && preview !== null

  // 確認画面を開くたび説明を取得し、通常データのquery cacheへ残さない。
  const prepare = async () => {
    const attempt = ++loadAttempt.current
    setBusy(true)
    setError(false)
    setPreview(null)
    try {
      const result = await prepareAccountDeletion()
      if (attempt === loadAttempt.current) setPreview(result)
    } catch {
      if (attempt === loadAttempt.current) setError(true)
    } finally {
      if (attempt === loadAttempt.current) setBusy(false)
    }
  }

  const cancelPreparation = () => {
    loadAttempt.current += 1
  }

  const confirm = () => {
    if (!preview || !preview.accepting_requests || busy || auth.status !== "authenticated") return
    setBusy(true)
    setError(false)
    try {
      auth.startAccountDeletion(preview)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return { preview, error, isPreparing, isSubmitting, prepare, cancelPreparation, confirm }
}

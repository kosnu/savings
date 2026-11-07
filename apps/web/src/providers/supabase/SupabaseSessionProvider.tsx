import { isAuthApiError, isAuthSessionMissingError, type Session } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useEffect, useRef, useState } from "react"

import { toInitialDisplayName } from "../../domain/displayName"
import { i18next } from "../../i18n"
import { loadAccountLanguage, resolveAccountLanguage } from "../../i18n/accountLanguage"
import {
  deletionReceiptEvent,
  clearLegacyDeletionReceipt,
  getMyDeletionState,
  type DeletionSubmission,
} from "../../lib/accountDeletion"
import { completeExplicitLogin } from "../../lib/explicitLogin"
import { captureSupabaseSessionError } from "../../lib/sentry"
import { getSupabaseClient } from "../../lib/supabase"
import { ensureAuthenticatedUser } from "./ensureAuthenticatedUser"

export type AuthStatus = "loading" | "unauthenticated" | "authenticated" | "error" | "suspended"

export type SupabaseSessionState =
  | {
      status: Exclude<AuthStatus, "error" | "suspended">
      session: Session | null
      reactivated?: boolean
    }
  | {
      status: "suspended"
      session: null
      authUserId: string
      submission?: DeletionSubmission
      onSignedOut: () => void
    }
  | { status: "error"; session: null; requiresSignIn: boolean; retry: () => void }

export const SupabaseSessionContext = createContext<SupabaseSessionState | undefined>(undefined)

interface SupabaseSessionProviderProps {
  children: ReactNode
}

const initialSessionState: SupabaseSessionState = {
  status: "loading",
  session: null,
}

const unauthenticatedSessionState: SupabaseSessionState = {
  status: "unauthenticated",
  session: null,
}

export function SupabaseSessionProvider({ children }: SupabaseSessionProviderProps) {
  const queryClient = useQueryClient()
  const sessionGenerationRef = useRef(0)
  const loginCallback = useRef<Promise<string | undefined> | undefined>(undefined)
  const stateRef = useRef<SupabaseSessionState>(initialSessionState)
  const [state, setState] = useState<SupabaseSessionState>(initialSessionState)

  useEffect(() => {
    clearLegacyDeletionReceipt()
    const supabase = getSupabaseClient()
    let isActive = true
    let reactivatedToken: string | undefined
    loginCallback.current ??= completeExplicitLogin(supabase.auth)
    let verifyingCallback = Boolean(loginCallback.current)

    const setSessionState = (nextState: SupabaseSessionState) => {
      if (
        nextState.status === "suspended" ||
        stateRef.current.session?.user.id !== nextState.session?.user.id
      ) {
        void queryClient.cancelQueries()
        queryClient.clear()
      }
      stateRef.current = nextState
      setState(nextState)
    }

    const suspend = (authUserId: string, submission?: DeletionSubmission) => {
      const suspended: SupabaseSessionState = {
        status: "suspended",
        session: null,
        authUserId,
        submission,
        onSignedOut: () => {
          if (!isActive || stateRef.current !== suspended) return
          sessionGenerationRef.current += 1
          setSessionState(unauthenticatedSessionState)
        },
      }
      setSessionState(suspended)
    }

    const handleSessionError = (
      error: unknown,
      sessionGeneration = sessionGenerationRef.current,
    ) => {
      captureSupabaseSessionError(error)
      if (!isActive) return
      if (sessionGenerationRef.current !== sessionGeneration) return

      if (stateRef.current.status !== "authenticated") {
        setSessionState({
          status: "error",
          session: null,
          requiresSignIn: needsSignIn(error),
          retry,
        })
      }
    }

    const isCurrentSessionHandler = (sessionGeneration: number) =>
      isActive && sessionGenerationRef.current === sessionGeneration

    const verifyAuthenticatedSession = async (session: Session, sessionGeneration: number) => {
      const { error: getUserError } = await supabase.auth.getUser()
      if (getUserError) {
        throw getUserError
      }

      if (!isCurrentSessionHandler(sessionGeneration)) return null
      const token = session.access_token
      const deletion = await getMyDeletionState(token)
      if (!isCurrentSessionHandler(sessionGeneration)) return null
      const reactivated = token === reactivatedToken
      if (deletion.status === "pending") return { deletion, reactivated: false }

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
        return { language: resolveAccountLanguage(accountLanguage, deviceLanguage), reactivated }
      } catch (error) {
        captureSupabaseSessionError(error)
        return { language: resolveAccountLanguage(undefined, deviceLanguage), reactivated }
      }
    }

    const handleSessionVerificationError = (
      error: unknown,
      sessionGeneration: number,
      shouldKeepCurrentSession: boolean,
    ) => {
      captureSupabaseSessionError(error)

      if (!isCurrentSessionHandler(sessionGeneration)) return
      // 同じユーザーの更新失敗では、検証前の有効な session を維持する。
      const requiresSignIn = needsSignIn(error)
      if (stateRef.current.status === "suspended" || (shouldKeepCurrentSession && !requiresSignIn))
        return

      setSessionState({ status: "error", session: null, requiresSignIn, retry })
    }

    const handleSession = async (session: Session | null, sessionGeneration: number) => {
      if (!isCurrentSessionHandler(sessionGeneration)) return

      if (!session) {
        const current = stateRef.current
        if (current.status === "error" && current.requiresSignIn) return
        if (current.status === "suspended") return
        setSessionState(unauthenticatedSessionState)
        return
      }

      const currentState = stateRef.current
      const shouldKeepCurrentSession = isSameAuthenticatedUser(currentState, session)

      const suspended =
        currentState.status === "suspended" && currentState.authUserId === session.user.id
          ? currentState
          : null
      // 送信中の同じsessionのrefreshで、遅延した申請の結果を上書きしない。
      if (suspended?.submission) return
      if (!shouldKeepCurrentSession && !suspended) {
        setSessionState({ status: "loading", session: null })
      }

      try {
        const verified = await verifyAuthenticatedSession(session, sessionGeneration)
        if (!verified || !isCurrentSessionHandler(sessionGeneration)) return

        if (verified.deletion) {
          if (!suspended) suspend(session.user.id)
          return
        }

        await i18next.changeLanguage(verified.language)
        if (!isCurrentSessionHandler(sessionGeneration)) return

        reactivatedToken = undefined
        setSessionState({ status: "authenticated", session, reactivated: verified.reactivated })
      } catch (error) {
        handleSessionVerificationError(error, sessionGeneration, shouldKeepCurrentSession)
      }
    }

    const loadSession = async (sessionGeneration: number) => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          handleSessionError(error, sessionGeneration)
          return
        }
        if (!isCurrentSessionHandler(sessionGeneration)) return

        await handleSession(data.session, sessionGeneration)
      } catch (error) {
        handleSessionError(error, sessionGeneration)
      }
    }

    const retry = () => {
      if (!isActive || stateRef.current.status !== "error") return

      sessionGenerationRef.current += 1
      setSessionState(initialSessionState)
      void loadSession(sessionGenerationRef.current)
    }

    const suspendForReceipt = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const submission: DeletionSubmission = event.detail
      const current = stateRef.current
      if (
        current.status !== "authenticated" ||
        current.session?.user.id !== submission.receipt.authUserId
      )
        return
      sessionGenerationRef.current += 1
      suspend(submission.receipt.authUserId, submission)
    }
    window.addEventListener(deletionReceiptEvent, suspendForReceipt)

    if (loginCallback.current) {
      void loginCallback.current.then((token) => {
        if (!isActive) return
        loginCallback.current = undefined
        reactivatedToken = token
        verifyingCallback = false
        void loadSession(sessionGenerationRef.current)
      })
    } else {
      void loadSession(sessionGenerationRef.current)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 通常ログインの検証中は既存sessionも新規sessionもアプリへ公開しない。
      if (verifyingCallback) return
      // 初期通知のnullは取得失敗でも届くため、未ログインの確定はgetSessionに任せる。
      if (event === "INITIAL_SESSION" && !session) return

      sessionGenerationRef.current += 1
      // 検証中にSDKが無効なsessionを破棄した場合も、再認証の理由を残す。
      if (event === "SIGNED_OUT" && stateRef.current.status === "loading") {
        setSessionState({ status: "error", session: null, requiresSignIn: true, retry })
        return
      }
      const generation = sessionGenerationRef.current
      if (!session) {
        void handleSession(null, generation)
        return
      }
      const current = stateRef.current
      if (
        !isSameAuthenticatedUser(current, session) &&
        !(current.status === "suspended" && current.authUserId === session.user.id)
      ) {
        setSessionState({ status: "loading", session: null })
      }
      // SDKのAuth lockの外で、認証を使うRPCを開始する。
      setTimeout(() => {
        void handleSession(session, generation)
      }, 0)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
      window.removeEventListener(deletionReceiptEvent, suspendForReceipt)
    }
  }, [queryClient])

  return <SupabaseSessionContext value={state}>{children}</SupabaseSessionContext>
}

function needsSignIn(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && (error.status === 401 || error.status === 403))
  )
}

function isSameAuthenticatedUser(currentState: SupabaseSessionState, session: Session): boolean {
  return (
    currentState.status === "authenticated" && currentState.session?.user.id === session.user.id
  )
}

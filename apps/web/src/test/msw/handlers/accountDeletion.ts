import { delay, type DelayMode, http, HttpResponse } from "msw"
import * as z from "zod"

import type { DeletionPreview, DeletionResult, MyDeletionState } from "../../../lib/accountDeletion"

export const deletionAuthUserId = "20870000-0000-4000-8000-000000000001"
export const deletionRequestId = "20870000-0000-4000-8000-000000000002"
export const deletionSecret = "a".repeat(64)
export const deletionTimes = {
  delete_after: "2099-11-13T06:00:00Z",
  purge_after: "2099-11-13T18:00:00Z",
}
export const deletionPreview: DeletionPreview = {
  auth_user_id: deletionAuthUserId,
  email: "deletion@example.com",
  explanation_version: "2026-11-06",
  sole_book_count: 1,
  shared_book_count: 1,
  accepting_requests: true,
  ...deletionTimes,
}
type RequestSuccess = {
  requestId: string
  secret: string
  explanationVersion: string
  result: DeletionResult
}
type ResultLookup = { requestId: string; secret: string; result: DeletionResult }
type ReactivationSuccess = { requestId: string; result: DeletionResult }

export function createAccountDeletionHandlers({
  preview = {},
  state = { status: "active" },
  result,
  request,
  reactivation,
}: {
  preview?: {
    response?: Partial<DeletionPreview>
    error?: boolean
    durationOrMode?: number | DelayMode
  }
  state?: MyDeletionState
  result?: ResultLookup & { error?: boolean; durationOrMode?: number | DelayMode }
  request?: RequestSuccess & { durationOrMode?: number | DelayMode }
  reactivation?: ReactivationSuccess
} = {}) {
  return [
    http.post("*/rest/v1/rpc/prepare_account_deletion", async () => {
      await delay(preview.durationOrMode)
      return preview.error
        ? HttpResponse.json({ message: "Preview unavailable" }, { status: 500 })
        : HttpResponse.json({ ...deletionPreview, ...preview.response })
    }),
    http.post("*/rest/v1/rpc/get_my_account_deletion_state", () => HttpResponse.json(state)),
    http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request: req }) => {
      await delay(result?.durationOrMode)
      if (result?.error)
        return HttpResponse.json({ message: "Result unavailable" }, { status: 500 })
      const body = z
        .object({ request_id: z.string(), result_secret: z.string() })
        .parse(await req.json())
      return HttpResponse.json(
        result && body.request_id === result.requestId && body.result_secret === result.secret
          ? result.result
          : { status: "not_confirmed" },
      )
    }),
    http.post("*/rest/v1/rpc/request_account_deletion", async ({ request: req }) => {
      await delay(request?.durationOrMode)
      const body = z
        .object({
          request_id: z.string(),
          result_secret: z.string(),
          explanation_version: z.string(),
        })
        .parse(await req.json())
      if (
        !request ||
        body.request_id !== request.requestId ||
        body.result_secret !== request.secret ||
        body.explanation_version !== request.explanationVersion
      )
        return HttpResponse.json({ message: "Request not allowed" }, { status: 403 })
      return HttpResponse.json(request.result)
    }),
    http.post("*/rest/v1/rpc/reactivate_my_account", async ({ request: req }) => {
      const body = z.object({ request_id: z.string() }).parse(await req.json())
      if (!reactivation || body.request_id !== reactivation.requestId)
        return HttpResponse.json({ message: "Reactivation not allowed" }, { status: 403 })
      return HttpResponse.json(reactivation.result)
    }),
  ]
}

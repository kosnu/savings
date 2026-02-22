import { env } from "../config/env"
import {
  ApiError,
  DomainValidationError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./apiErrors"
import { getSupabaseClient } from "./supabase"

export function buildFunctionUrl(functionName: string, path?: string): string {
  const base = `${env.SUPABASE_URL}/functions/v1/${functionName}`
  return path ? `${base}${path}` : base
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession()

  if (error || !data.session) {
    throw new UnauthorizedError()
  }

  return data.session.access_token
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>
  }

  let body: Record<string, unknown>
  try {
    body = (await response.json()) as Record<string, unknown>
  } catch {
    throw new ApiError(response.status, response.statusText)
  }

  switch (response.status) {
    case 401:
      throw new UnauthorizedError(
        typeof body.message === "string" ? body.message : undefined,
      )
    case 400: {
      if ("fieldErrors" in body || "formErrors" in body) {
        throw new ValidationError({
          fieldErrors: (body.fieldErrors as Record<string, string[]>) ?? {},
          formErrors: (body.formErrors as string[]) ?? [],
        })
      }
      throw new DomainValidationError({
        message:
          typeof body.message === "string" ? body.message : "Bad Request",
        details: typeof body.details === "string" ? body.details : undefined,
      })
    }
    case 404:
      throw new NotFoundError(
        typeof body.message === "string" ? body.message : undefined,
      )
    case 500:
      throw new InternalServerError({
        message: typeof body.message === "string" ? body.message : undefined,
        details: typeof body.details === "string" ? body.details : undefined,
        hint: typeof body.hint === "string" ? body.hint : undefined,
        code: typeof body.code === "string" ? body.code : undefined,
      })
    default:
      throw new ApiError(
        response.status,
        typeof body.message === "string" ? body.message : response.statusText,
      )
  }
}

export interface ApiRequestOptions {
  params?: Record<string, string | undefined>
  body?: unknown
  fetchOptions?: Omit<RequestInit, "method" | "headers" | "body">
}

async function apiFetch<T>(
  method: string,
  url: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const token = await getAccessToken()

  let fullUrl = url
  if (options?.params) {
    const entries = Object.entries(options.params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    )
    if (entries.length > 0) {
      const searchParams = new URLSearchParams(entries)
      fullUrl = `${url}?${searchParams.toString()}`
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    ...options?.fetchOptions,
  })

  return handleResponse<T>(response)
}

export const apiClient = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>("GET", url, options),
  post: <T>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>("POST", url, options),
  put: <T>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>("PUT", url, options),
  delete: <T>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>("DELETE", url, options),
  patch: <T>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>("PATCH", url, options),
}

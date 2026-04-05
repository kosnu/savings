import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderHookOptions,
  type RenderOptions,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PropsWithChildren, ReactElement } from "react"

import { createQueryClient } from "../lib/queryClient"
import { SnackbarProvider } from "../providers/snackbar"
import {
  SupabaseSessionContext,
  type SupabaseSessionState,
} from "../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../providers/theme/ThemeProvider"
import { mockSession } from "./data/supabaseSession"

export * from "@testing-library/react"

interface TestProviderOptions {
  queryClient?: QueryClient
  sessionState?: SupabaseSessionState
  withProviders?: boolean
}

export type TestUser = ReturnType<typeof userEvent.setup>

export interface TestRenderOptions extends Omit<RenderOptions, "wrapper">, TestProviderOptions {
  userOptions?: Parameters<typeof userEvent.setup>[0]
}

export interface TestRenderHookOptions<Props>
  extends Omit<RenderHookOptions<Props>, "wrapper">, TestProviderOptions {}

function createDefaultSessionState(): SupabaseSessionState {
  return {
    status: "authenticated",
    session: mockSession(),
  }
}

function TestProviders({
  children,
  queryClient,
  sessionState,
}: PropsWithChildren<{
  queryClient: QueryClient
  sessionState: SupabaseSessionState
}>) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseSessionContext value={sessionState}>
        <ThemeProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </ThemeProvider>
      </SupabaseSessionContext>
    </QueryClientProvider>
  )
}

function createWrapper({
  queryClient,
  sessionState,
  withProviders = true,
}: TestProviderOptions = {}) {
  if (!withProviders) {
    return function Wrapper({ children }: PropsWithChildren) {
      return <>{children}</>
    }
  }

  const resolvedQueryClient = queryClient ?? createQueryClient()
  const resolvedSessionState = sessionState ?? createDefaultSessionState()

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <TestProviders queryClient={resolvedQueryClient} sessionState={resolvedSessionState}>
        {children}
      </TestProviders>
    )
  }
}

export function render(ui: ReactElement, options: TestRenderOptions = {}) {
  const { queryClient, sessionState, userOptions, withProviders, ...renderOptions } = options
  const user = userEvent.setup(userOptions)

  return {
    user,
    ...rtlRender(ui, {
      wrapper: createWrapper({ queryClient, sessionState, withProviders }),
      ...renderOptions,
    }),
  }
}

export function renderHook<Result, Props>(
  renderCallback: (initialProps: Props) => Result,
  options: TestRenderHookOptions<Props> = {},
) {
  const { queryClient, sessionState, withProviders, ...renderOptions } = options

  return rtlRenderHook(renderCallback, {
    wrapper: createWrapper({ queryClient, sessionState, withProviders }),
    ...renderOptions,
  })
}

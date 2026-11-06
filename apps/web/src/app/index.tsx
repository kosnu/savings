import { TanStackDevtools } from "@tanstack/react-devtools"
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

import { AccountActionCallback, AccountDeletionStatus } from "../features/profile"
import { completeAccountAction } from "../lib/accountAction"
import { ThemeProvider } from "../providers/theme/ThemeProvider"
import { Provider } from "./Provider"
import { Router } from "./Router"

// StrictModeでも一回限りのOAuth codeを二重交換しない。
let accountAction: ReturnType<typeof completeAccountAction> | undefined

function App() {
  // 通常clientのURL検出と認証同期より先に専用pathnameを分岐する。
  if (window.location.pathname === "/auth/account-action") {
    accountAction ??= completeAccountAction()
    return (
      <ThemeProvider>
        <AccountActionCallback completion={accountAction} />
      </ThemeProvider>
    )
  }
  if (window.location.pathname === "/account-deletion")
    return (
      <ThemeProvider>
        <AccountDeletionStatus />
      </ThemeProvider>
    )
  return (
    <Provider>
      <Router />
      <TanStackDevtools
        plugins={[
          {
            name: "TanStack Query",
            render: <ReactQueryDevtoolsPanel />,
            defaultOpen: true,
          },
          {
            name: "TanStack Form",
            render: <FormDevtoolsPanel />,
            defaultOpen: false,
          },
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
            defaultOpen: false,
          },
        ]}
      />
    </Provider>
  )
}

export default App

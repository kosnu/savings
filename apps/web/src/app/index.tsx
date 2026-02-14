import { TanStackDevtools } from "@tanstack/react-devtools"
import { FormDevtoolsPanel } from "@tanstack/react-form-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { Provider } from "./Provider"
import { Router } from "./Router"

function App() {
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
        ]}
      />
    </Provider>
  )
}

export default App

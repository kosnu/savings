import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider as RRDRouterProvider,
} from "react-router-dom"
import { paths } from "../config/paths"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { ErrorPage } from "./routes/ErrorPage"
import { PaymentsPage } from "./routes/PaymentsPage"
import { TopPage } from "./routes/TopPage"

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route
        path={paths.root.path}
        element={<TopPage />}
        errorElement={<ErrorPage />}
      />
      <Route element={<AppLayout />} errorElement={<ErrorPage />}>
        <Route path={paths.payments.path} element={<PaymentsPage />} />
        <Route path={paths.aggregates.path} element={<AggregatesPage />} />
      </Route>
    </Route>,
  ),
)

export function Router() {
  return <RRDRouterProvider router={router} />
}

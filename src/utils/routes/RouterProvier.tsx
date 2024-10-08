import {
  RouterProvider as RRDRouterProvider,
  Route,
  Routes,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom"
import { AppLayout } from "../../components/AppLayout"
import { ErrorPage } from "../../pages/ErrorPage"
import { PaymentsPage } from "../../pages/PaymentsPage"

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/" />
      <Route element={<AppLayout />} errorElement={<ErrorPage />}>
        <Route path="/payments" element={<PaymentsPage />} />
      </Route>
    </Route>,
  ),
)

export function RouterProvider() {
  return <RRDRouterProvider router={router} />
}

import {
  RouterProvider as RRDRouterProvider,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom"
import { AppLayout } from "../../components/AppLayout"
import { ErrorPage } from "../../pages/ErrorPage"
import { PaymentsPage } from "../../pages/PaymentsPage"
import { TopPage } from "../../pages/TopPage/TopPage"

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/" element={<TopPage />} errorElement={<ErrorPage />} />
      <Route element={<AppLayout />} errorElement={<ErrorPage />}>
        <Route path="/payments" element={<PaymentsPage />} />
      </Route>
    </Route>,
  ),
)

export function RouterProvider() {
  return <RRDRouterProvider router={router} />
}

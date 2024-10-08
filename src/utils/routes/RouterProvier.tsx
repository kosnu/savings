import {
  RouterProvider as RRDRouterProvider,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom"
import { AppLayout } from "../../components/AppLayout"
import { ErrorPage } from "../../pages/ErrorPage"
import { TopPage } from "../../pages/TopPage"

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<AppLayout />} errorElement={<ErrorPage />}>
      <Route path="payments" element={<TopPage />} />
    </Route>,
  ),
)

export function RouterProvider() {
  return <RRDRouterProvider router={router} />
}

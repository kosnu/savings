import { afterAll, afterEach, beforeAll } from "vite-plus/test"

import { server } from "./src/test/msw/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

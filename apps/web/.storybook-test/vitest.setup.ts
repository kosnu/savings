import { vi } from "vitest"

import "../.storybook/vitest.setup"

vi.mock("msw", async (importOriginal) => {
  const msw = await importOriginal<typeof import("msw")>()

  return {
    ...msw,
    // 未指定時のランダム遅延を除き、loading検証用に明示された遅延は維持する。
    delay: async (durationOrMode: Parameters<typeof msw.delay>[0] = 0) => msw.delay(durationOrMode),
  }
})

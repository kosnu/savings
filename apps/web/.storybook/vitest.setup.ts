import { setProjectAnnotations } from "@storybook/react-vite"
import { vi } from "vitest"
import * as projectAnnotations from "./preview"

// Supabase Auth をモック — fetchCategories 等で getAccessToken() が呼ばれたときに
// ダミートークンを返すことで、MSW ハンドラが HTTP リクエストをインターセプトできるようにする
vi.mock("../src/lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-access-token" } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}))

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([projectAnnotations])

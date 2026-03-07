import { setProjectAnnotations } from "@storybook/react-vite"
import { createClient } from "@supabase/supabase-js"
import { vi } from "vitest"
import * as projectAnnotations from "./preview"

const supabase = createClient("http://localhost:54321", "test-anon-key")

// Storybookテストでは MSW がHTTP層を差し替えるため、実クライアントを返して
// QueryBuilder(from/select/gte/lte) を利用可能にしておく。
vi.mock("../src/lib/supabase", () => ({
  getSupabaseClient: () => supabase,
}))

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([projectAnnotations])

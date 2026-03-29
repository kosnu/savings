import { createClient } from "@supabase/supabase-js"
import { vi } from "vitest"

const supabase = createClient("http://localhost:54321", "test-anon-key")

// Storybookテストでは MSW がHTTP層を差し替えるため、実クライアントを返して
// QueryBuilder(from/select/gte/lte) を利用可能にしておく。
vi.mock("../src/lib/supabase", () => ({
  getSupabaseClient: () => supabase,
}))

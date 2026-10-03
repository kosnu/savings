import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

import config from "../../apps/web/cloudflare.config.ts"
import { validateDevelopment, previewName, validateBuildOutput } from "./preview.mjs"

const dev = {
  VITE_SUPABASE_URL: "https://ufekmuxkmodwydxmdbln.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
}

test("同じブランチは同じ名前、slug が衝突しても別ブランチは別 Preview", () => {
  const branches = [
    "feature/a",
    "feature-a",
    "Feature/a",
    "日本語",
    "別の日本語",
    "x".repeat(200),
    "x".repeat(201),
  ]
  const names = branches.map(previewName)
  assert.equal(new Set(names).size, branches.length)
  for (let i = 0; i < branches.length; i++) {
    assert.equal(previewName(branches[i]), names[i])
    assert.match(names[i], /^[a-z0-9-]{1,63}$/u)
  }
  for (const branch of ["", "HEAD", "hello\nworld"]) assert.throws(() => previewName(branch))
})

test("Dev 設定不足、本番 ref、権限の強いキーをネットワーク前に拒否", () => {
  for (const ref of [
    undefined,
    "izuzqvgvgquqqimwuygw",
    "abcdefghijklmnopqrst",
    "https://example.com",
    "bad/ref",
  ]) {
    assert.throws(() =>
      validateDevelopment({
        ...dev,
        VITE_SUPABASE_URL: ref ? `https://${ref}.supabase.co` : undefined,
      }),
    )
  }
  for (const key of [undefined, "", "sb_secret_secret", "eyJ.legacy.jwt"]) {
    assert.throws(() => validateDevelopment({ ...dev, VITE_SUPABASE_PUBLISHABLE_KEY: key }))
  }
})

test("Preview context は mode を間違えても本番 Worker/domain を選ばない", () => {
  for (const mode of [undefined, "development", "production"]) {
    const { worker } = config({ mode, isPreview: true })
    assert.equal(worker.name, "burneto-dev")
    assert.deepEqual(worker.domains, [])
  }
  assert.equal(config({ mode: "development", isPreview: false }).worker.name, "burneto-dev")
  assert.equal(config({ mode: "production", isPreview: false }).worker.name, "burneto")
  assert.deepEqual(config({ mode: "production", isPreview: false }).worker.domains, ["burneto.com"])
})

test("本番・古い成果物や本番 binding/domain の混入を配信前に拒否", () => {
  const root = { buildContext: { mode: "development", isPreview: true } }
  const { worker } = config({ mode: "development", isPreview: true })
  assert.doesNotThrow(() => validateBuildOutput(root, worker))
  for (const build of [
    {},
    { buildContext: { mode: "production", isPreview: true } },
    { buildContext: { mode: "development" } },
    { ...root, accountId: "other-account" },
  ]) {
    assert.throws(() => validateBuildOutput(build, worker))
  }
  for (const patch of [
    { name: "burneto" },
    { domains: ["burneto.com"] },
    { bindings: { DB: "production" } },
    { workersDev: false },
    { main: "worker.js" },
  ]) {
    assert.throws(() => validateBuildOutput(root, { ...worker, ...patch }))
  }
})

test("補助コマンドと同じ名前のbranchも配信名になる", () => {
  const actual = execFileSync(
    process.execPath,
    [new URL("preview.mjs", import.meta.url).pathname, "name", "check-build"],
    { env: { ...process.env, ...dev }, encoding: "utf8" },
  ).trim()
  assert.equal(actual, previewName("check-build"))
})

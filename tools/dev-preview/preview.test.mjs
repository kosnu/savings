import assert from "node:assert/strict"
import { test } from "node:test"

import config from "../../apps/web/cloudflare.config.ts"
import {
  developmentEnv,
  previewName,
  previewUrl,
  productionRef,
  validateBuildOutput,
} from "./preview.mjs"

const dev = {
  DEV_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  DEV_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
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
  for (const ref of [undefined, productionRef, "https://example.com", "bad/ref"]) {
    assert.throws(() => developmentEnv({ ...dev, DEV_SUPABASE_PROJECT_REF: ref }))
  }
  for (const key of [undefined, "", "sb_secret_secret", "eyJ.legacy.jwt"]) {
    assert.throws(() => developmentEnv({ ...dev, DEV_SUPABASE_PUBLISHABLE_KEY: key }))
  }
})

test("本番 URL・Sentry・配信/DB token をビルドへ渡さない", () => {
  const env = developmentEnv({
    ...dev,
    PATH: "/bin",
    VITE_SUPABASE_URL: "https://production.invalid",
    VITE_SENTRY_DSN: "https://sentry.invalid",
    SENTRY_AUTH_TOKEN: "secret",
    SUPABASE_ACCESS_TOKEN: "secret",
    CLOUDFLARE_API_TOKEN: "secret",
    AUTH_SITE_URL: "production",
  })
  assert.equal(env.VITE_SUPABASE_URL, "https://abcdefghijklmnopqrst.supabase.co")
  assert.equal(env.VITE_SENTRY_DSN, "")
  assert.equal(env.NODE_ENV, "production")
  assert.equal(env.CLOUDFLARE_PREVIEW_BUILD, "true")
  for (const key of [
    "SENTRY_AUTH_TOKEN",
    "SUPABASE_ACCESS_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "AUTH_SITE_URL",
  ])
    assert.equal(env[key], undefined)
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

test("cf の配信結果からのみ安定 URL を報告し、不一致・空・本番 URL を拒否", () => {
  const name = previewName("feature/test")
  const url = `https://${name}-burneto-dev.example.workers.dev`
  const result = {
    type: "preview",
    preview_name: name,
    deployment_id: "deployment",
    preview_urls: [url],
  }
  assert.equal(previewUrl(result, name), url)
  for (const patch of [
    { type: "production" },
    { preview_name: "other" },
    { deployment_id: "" },
    { preview_urls: [] },
    { preview_urls: ["https://burneto.com"] },
    { preview_urls: [url + ".evil.invalid"] },
  ]) {
    assert.throws(() => previewUrl({ ...result, ...patch }, name))
  }
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

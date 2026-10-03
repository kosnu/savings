import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const workerName = "burneto-dev"

export function previewName(branch) {
  if (
    !branch ||
    branch === "HEAD" ||
    [...branch].some((char) => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)
  ) {
    throw new Error("ブランチ名が必要です（detached HEAD は明示指定）。")
  }
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 12)
  const shortSlug = slug.slice(0, 20).replace(/-$/u, "")
  return `b-${shortSlug.length ? shortSlug : "branch"}-${hash}`
}

export function validateDevelopment(env) {
  if (env.VITE_SUPABASE_URL !== "https://ufekmuxkmodwydxmdbln.supabase.co") {
    throw new Error("共有 Dev の VITE_SUPABASE_URL が必要です。")
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/u.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")) {
    throw new Error("Dev の publishable key が必要です。")
  }
}

export function validateBuildOutput(root, worker) {
  if (
    root.buildContext?.mode !== "development" ||
    root.buildContext?.isPreview !== true ||
    root.accountId
  ) {
    throw new Error("development Preview の Build Output が必要です。")
  }
  // 静的配信以外の binding / trigger / server code はこの経路の対象外。
  const allowed = ["name", "compatibilityDate", "assets", "domains", "workersDev"]
  if (
    worker.name !== workerName ||
    worker.workersDev !== true ||
    !Array.isArray(worker.domains) ||
    worker.domains.length !== 0 ||
    Object.keys(worker).some((key) => !allowed.includes(key)) ||
    worker.assets?.notFoundHandling !== "single-page-application"
  ) {
    throw new Error("本番 domain / Worker / binding を含まない Dev 静的成果物が必要です。")
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "check-build") {
    const root = new URL("../../apps/web/.cloudflare/output/v0/", import.meta.url)
    const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"))
    validateBuildOutput(read("config.json"), read("workers/default/worker.config.json"))
  } else if (process.argv[2] === "name") {
    validateDevelopment(process.env)
    console.log(previewName(process.argv[3]))
  } else {
    throw new Error("Usage: preview.mjs name <branch> | check-build")
  }
}

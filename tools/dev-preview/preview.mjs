import { createHash } from "node:crypto"

// 公開済みの本番識別子。Dev の誤設定をネットワーク接続前に拒否する。
export const productionRef = "izuzqvgvgquqqimwuygw"
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

export function developmentEnv(env) {
  const ref = env.DEV_SUPABASE_PROJECT_REF
  if (!ref || !/^[a-z]{20}$/u.test(ref) || ref === productionRef) {
    throw new Error("本番とは異なる DEV_SUPABASE_PROJECT_REF が必要です。")
  }
  const key = env.DEV_SUPABASE_PUBLISHABLE_KEY
  if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/u.test(key)) {
    throw new Error(
      "Dev の publishable key が必要です。secret/service_role/legacy JWT は使えません。",
    )
  }
  // ローカル .env や継承された本番向け VITE_* / Sentry 設定を優先させない。
  const clean = Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => !/^(VITE_|SENTRY_|SUPABASE_|AUTH_|CLOUDFLARE_)/u.test(name),
    ),
  )
  return {
    ...clean,
    NODE_ENV: "production",
    CF_SEND_TELEMETRY: "false",
    CLOUDFLARE_PREVIEW_BUILD: "true",
    VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
    VITE_SUPABASE_PUBLISHABLE_KEY: key,
    VITE_SENTRY_DSN: "",
    VITE_SENTRY_ENVIRONMENT: "development",
  }
}

export function previewUrl(result, name) {
  if (result.type !== "preview" || result.preview_name !== name || !result.deployment_id) {
    throw new Error("cf が期待した Preview の配信結果を返しませんでした。")
  }
  const urls = result.preview_urls
  if (!Array.isArray(urls)) throw new Error("Preview URL がありません。")
  const url = urls.find((value) => {
    try {
      const parsed = new URL(value)
      return (
        parsed.protocol === "https:" &&
        parsed.hostname.startsWith(`${name}-${workerName}.`) &&
        parsed.hostname.endsWith(".workers.dev") &&
        parsed.pathname === "/" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash
      )
    } catch {
      return false
    }
  })
  if (!url) throw new Error("期待した Dev workers.dev URL がありません。")
  return url
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

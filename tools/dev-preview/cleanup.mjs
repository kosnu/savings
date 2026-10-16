import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { githubGet, validatePR } from "./lifecycle.mjs"
import { previewName, prPreviewName, workerName } from "./preview.mjs"

export async function cleanupPreview(env, get, fetcher = fetch, report = () => {}) {
  const {
    PR_NUMBER,
    PREVIEW_BRANCH,
    GITHUB_REPOSITORY,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN,
  } = env
  const names = [prPreviewName(PR_NUMBER), previewName(PREVIEW_BRANCH)]
  const pr = validatePR(
    await get(`/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`),
    GITHUB_REPOSITORY,
  )
  if (pr.state !== "closed") {
    for (const name of names) report(name, "open PR のため削除しない")
    return
  }
  // 移行前の branch Preview を共有する他 PR だけを保護する。新 Preview は PR ごとに分離。
  let legacyShared = false
  for (let page = 1; ; page++) {
    const others = await get(
      `/repos/${GITHUB_REPOSITORY}/pulls?state=open&per_page=100&page=${page}`,
    )
    if (!Array.isArray(others)) throw new Error("open PR 一覧が不正です。")
    legacyShared ||= others.some(
      (other) =>
        String(other.number) !== PR_NUMBER &&
        other.head?.repo?.full_name === GITHUB_REPOSITORY &&
        other.head?.ref === PREVIEW_BRANCH,
    )
    if (legacyShared || others.length < 100) break
  }
  if (!/^[a-f0-9]{32}$/u.test(CLOUDFLARE_ACCOUNT_ID ?? "") || !CLOUDFLARE_API_TOKEN) {
    throw new Error("Dev Cloudflare account と token が必要です。")
  }
  const workersBase = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/workers`
  const base = `${workersBase}/${workerName}/previews`
  const request = async (url, method = "GET") => {
    const response = await fetcher(url, {
      method,
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    })
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`Cloudflare ${method} returned invalid JSON (${response.status})`)
    }
    if (
      !response.ok ||
      body.success !== true ||
      (body.errors !== null && (!Array.isArray(body.errors) || body.errors.length))
    ) {
      // token や upstream の本文はログへ出さない。404 も一覧で不在を確認するまで成功にしない。
      const error = new Error(`Cloudflare ${method} failed (${response.status})`)
      error.status = response.status
      throw error
    }
    return body
  }
  const workerExists = async () => {
    for (let page = 1; ; page++) {
      const body = await request(`${workersBase}?per_page=100&page=${page}`)
      if (!Array.isArray(body.result)) throw new Error("Worker 一覧が不正です。")
      if (body.result.some((worker) => worker.name === workerName)) return true
      if (body.result.length < 100) return false
      if (page >= 100) throw new Error("Worker pagination の上限を超えました。")
    }
  }
  const exists = async (name) => {
    for (let page = 1; ; page++) {
      let body
      try {
        body = await request(`${base}?name=${encodeURIComponent(name)}&per_page=100&page=${page}`)
      } catch (error) {
        // parent 未作成でも Preview は不在。404 本文だけからは判断しない。
        if (error.status === 404 && !(await workerExists())) return false
        throw error
      }
      if (!Array.isArray(body.result)) throw new Error("Preview 一覧が不正です。")
      if (body.result.some((preview) => preview.name === name)) return true
      const totalPages = body.result_info?.total_pages
      if (totalPages !== undefined && (!Number.isInteger(totalPages) || totalPages < 0))
        throw new Error("Preview pagination が不正です。")
      if (totalPages === undefined ? body.result.length < 100 : page >= totalPages) return false
      if (page >= 100) throw new Error("Preview pagination の上限を超えました。")
    }
  }
  for (const name of names) {
    try {
      if (name === names[1] && legacyShared) {
        report(name, "同じ branch の他 open PR が使用中のため保護")
        continue
      }
      if (!(await exists(name))) {
        report(name, "Preview は不在（正常終了）")
        continue
      }
      // Worker・DB・Auth の削除 endpoint や force は使わない。
      try {
        await request(`${base}/${encodeURIComponent(name)}`, "DELETE")
      } catch (error) {
        if (error.status !== 404 || (await exists(name))) throw error
        report(name, "Preview は既に削除済み（正常終了）")
        continue
      }
      if (await exists(name)) throw new Error("削除後も対象 Preview が存在します。")
      report(name, "Preview 削除成功")
    } catch (error) {
      report(name, "失敗。Actions の失敗 step を確認してください。")
      throw error
    }
  }
}

export async function runCleanup(
  env,
  get,
  fetcher = fetch,
  summary = (text) => appendFileSync(env.GITHUB_STEP_SUMMARY, text),
) {
  const names = [prPreviewName(env.PR_NUMBER), previewName(env.PREVIEW_BRANCH)]
  summary(
    `## Dev Preview cleanup\n\n- PR: #${env.PR_NUMBER}\n- 親 Worker: ${workerName}\n- 対象: ${names.join(", ")}\n`,
  )
  try {
    await cleanupPreview(env, get, fetcher, (name, result) => {
      summary(`- ${name}: ${result}\n`)
      console.log(`${workerName} / ${name}: ${result}`)
    })
  } catch (error) {
    summary("- Cleanup job: 失敗。未処理の対象は削除完了として扱わない。\n")
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCleanup(process.env, githubGet(process.env)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

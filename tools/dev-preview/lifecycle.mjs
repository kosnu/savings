import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import { authorize, deploymentRequest } from "./authorize.mjs"
import { previewName, prPreviewName } from "./preview.mjs"

export function validatePR(pr, repository) {
  if (
    !["open", "closed"].includes(pr.state) ||
    pr.base?.ref !== "main" ||
    pr.head?.repo?.full_name !== repository ||
    !/^[a-f0-9]{40}$/u.test(pr.head?.sha ?? "")
  )
    throw new Error("同一 repository の main 宛て PR が必要です。")
  previewName(pr.head.ref)
  return pr
}

export async function resolveLifecycle(event, env, get) {
  const repository = env.GITHUB_REPOSITORY
  const target = env.GITHUB_EVENT_NAME === "pull_request_target"
  const number = String(target ? event.number : event.inputs?.pr_number)
  if (
    !/^[1-9][0-9]*$/u.test(number) ||
    (!target &&
      !(env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main"))
  )
    throw new Error("main の PR lifecycle event または手動実行が必要です。")
  if (target) {
    validatePR(event.pull_request, repository)
    if (
      !(
        event.action === "closed" ||
        (event.action === "labeled" && event.label?.name === "preview")
      )
    ) {
      throw new Error("Preview の要求または PR 終了 event が必要です。")
    }
  }
  const pr = validatePR(await get(`/repos/${repository}/pulls/${number}`), repository)
  // 古い配信要求が終了通知を置き換えても、終了済みなら配信せず削除へ進める。
  const branch = target ? event.pull_request.head.ref : pr.head.ref
  previewName(branch)
  if (event.action === "closed" || pr.state === "closed") {
    return { number, branch, sha: pr.head.sha, deploy: false }
  }
  const request = deploymentRequest(
    target ? event : { ...event, inputs: { ...event.inputs, head_sha: pr.head.sha } },
    env.GITHUB_EVENT_NAME,
    env.GITHUB_REF,
    repository,
  )
  request.branch = branch
  const approved = await authorize(request, repository, async () => pr)
  return { number, ...approved, deploy: true }
}

export function githubGet(env, fetcher = fetch) {
  if (!env.GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/u.test(env.GITHUB_REPOSITORY ?? "")) {
    throw new Error("GitHub read token と repository が必要です。")
  }
  return async (path) => {
    const response = await fetcher(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`GitHub prerequisite read failed (${response.status})`)
    return response.json()
  }
}

export async function reconcilePR(env, get) {
  prPreviewName(env.PR_NUMBER)
  const pr = validatePR(
    await get(`/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}`),
    env.GITHUB_REPOSITORY,
  )
  return { closed: pr.state === "closed" }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env
  const get = githubGet(env)
  try {
    const result =
      process.argv[2] === "reconcile"
        ? await reconcilePR(env, get)
        : await resolveLifecycle(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")), env, get)
    appendFileSync(
      env.GITHUB_OUTPUT,
      Object.entries(result)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
